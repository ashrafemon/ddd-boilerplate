import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { hashInboxPayload } from '@platform/platform-common/inbox/types/inbox.types';
import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import {
  SagaDefinitionRecord,
  SagaInstanceRecord,
  SagaInstanceReason,
  SagaTriggerEvent,
} from '../types/saga.types';
import { evaluateCondition, evaluateExpression, renderTemplate } from '../types/saga-expression';
import { CompanySettingsReader } from '../outbound/ports/company-settings.port';
import { FeatureGate } from '../outbound/ports/feature-gate.port';
import { SagaCompanyConfigRepositoryPort } from '../outbound/ports/saga-company-config.repository.port';
import { SagaDefinitionRepositoryPort } from '../outbound/ports/saga-definition.repository.port';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';
import { BuildSagaPlanUseCase } from './build-saga-plan.usecase';
import { BufferSagaEventUseCase } from './buffer-saga-event.usecase';
import { CancelSagaUseCase } from './cancel-saga.usecase';
import { StartSagaUseCase } from './start-saga.usecase';

const MAX_INSTANCES_PER_EVENT = 100;

/**
 * Use case: route one delivered event to the sagas it belongs to.
 *
 * Five checks, in order, exactly as the design states them: `requires` +
 * policy (plan build), overlay (narrows), `if` (reached at advance time),
 * `when` (start filter / per-event WAIT filter), `match` (correlation key).
 *
 * Loop guard: the saga's own emitted events (`aggregateType = 'Saga'`) never
 * re-enter, so an `onComplete.emit` that happens to match a start event cannot
 * start another saga.
 */
@Injectable()
export class AcceptSagaEventUseCase {
  private readonly logger = new Logger(AcceptSagaEventUseCase.name);

  constructor(
    private readonly definitions: SagaDefinitionRepositoryPort,
    private readonly configs: SagaCompanyConfigRepositoryPort,
    private readonly instances: SagaInstanceRepositoryPort,
    private readonly planBuilder: BuildSagaPlanUseCase,
    private readonly startSaga: StartSagaUseCase,
    private readonly cancelSaga: CancelSagaUseCase,
    private readonly bufferEvent: BufferSagaEventUseCase,
    private readonly featureGate: FeatureGate,
    private readonly settings: CompanySettingsReader,
    private readonly requestContext: RequestContextPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(envelope: OutboxEnvelope): Promise<void> {
    if (envelope.aggregateType === 'Saga') {
      return;
    }
    if (!envelope.tenantId || !envelope.companyId) {
      this.logger.warn(`Saga event ${envelope.eventType} has no tenant/company — ignored`);
      return;
    }

    const event: SagaTriggerEvent = {
      eventId: envelope.eventId,
      eventName: envelope.eventType,
      eventVersion: envelope.eventVersion ?? 1,
      tenantId: envelope.tenantId,
      companyId: envelope.companyId,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
      payload: envelope.payload,
    };

    await this.requestContext.run(
      {
        tenantId: event.tenantId,
        companyId: event.companyId,
        correlationId: event.correlationId,
      },
      () => this.route(event),
    );
  }

  private async route(event: SagaTriggerEvent): Promise<void> {
    const start = await this.definitions.findActiveByEvent(event.eventName, event.eventVersion);
    if (start) {
      await this.tryStart(start, event);
      return;
    }

    for (const definition of await this.definitions.listActive()) {
      if (this.isCancelEvent(definition, event)) {
        await this.routeCancel(definition, event);
      }
      await this.routeWait(definition, event);
    }
  }

  private async tryStart(definition: SagaDefinitionRecord, event: SagaTriggerEvent): Promise<void> {
    const spec = definition.definition.start;
    let features: ReadonlySet<string>;
    let settings: Record<string, unknown>;
    try {
      features = await this.featureGate.enabled(event.companyId);
      settings = await this.settings.get(event.companyId);
    } catch (err) {
      this.logger.error(
        `Saga ${definition.sagaKey}: gating lookup failed — ${(err as Error).message}`,
      );
      return;
    }

    const triggerScope: Record<string, unknown> = {
      event: event.payload,
      saga: {},
      company: { settings },
      steps: {},
    };
    if (spec.when && !evaluateCondition(spec.when, triggerScope)) {
      return;
    }

    const overlay =
      (await this.configs.findActive(event.tenantId, event.companyId, definition.sagaKey))
        ?.overlay ?? null;

    const plan = this.planBuilder.execute({
      definition: definition.definition,
      overlay,
      features,
      settings,
      defaultMaxAttempts: this.configService.getSaga().defaultMaxAttempts,
    });
    if (!plan) {
      return;
    }

    const correlationKey = renderTemplate(spec.key, triggerScope);
    const instance = await this.startSaga.execute({
      tenantId: event.tenantId,
      companyId: event.companyId,
      sagaKey: definition.sagaKey,
      definitionId: definition.id,
      configId: null,
      correlationKey,
      plan,
      context: {
        settings,
        event: event.payload,
        start: this.mapContext(spec.context, triggerScope),
      },
      deadlineAt: null,
    });

    if (instance) {
      this.logger.log(`Started saga ${definition.sagaKey} (${instance.id}) for ${correlationKey}`);
    }
  }

  private async routeCancel(
    definition: SagaDefinitionRecord,
    event: SagaTriggerEvent,
  ): Promise<void> {
    const key = renderTemplate(definition.definition.start.key, { event: event.payload });
    const instance = await this.findTarget(definition.sagaKey, key);
    if (instance) {
      await this.cancelSaga.execute(instance.id, SagaInstanceReason.CANCELLED_BY_EVENT);
    }
  }

  private async routeWait(
    definition: SagaDefinitionRecord,
    event: SagaTriggerEvent,
  ): Promise<void> {
    const payloadHash = hashInboxPayload(event.payload);
    const waitSteps = definition.definition.steps.filter(
      step =>
        step.waitFor?.name === event.eventName && step.waitFor?.version === event.eventVersion,
    );
    if (waitSteps.length === 0) {
      return;
    }

    const targets = new Map<string, SagaInstanceRecord>();
    for (const step of waitSteps) {
      if (step.match) {
        const key = renderTemplate(step.match, { event: event.payload });
        const instance = await this.findTarget(definition.sagaKey, key);
        if (instance) {
          targets.set(instance.id, instance);
        }
      }
    }
    const parked = await this.instances.findWaitingByEvent(
      event.eventName,
      event.eventVersion,
      MAX_INSTANCES_PER_EVENT,
    );
    for (const instance of parked) {
      if (instance.sagaKey === definition.sagaKey) {
        targets.set(instance.id, instance);
      }
    }

    for (const instance of targets.values()) {
      await this.bufferEvent.execute({
        instance,
        eventId: event.eventId,
        eventName: event.eventName,
        eventVersion: event.eventVersion,
        payload: event.payload,
        payloadHash,
      });
    }
  }

  private isCancelEvent(definition: SagaDefinitionRecord, event: SagaTriggerEvent): boolean {
    return Boolean(
      definition.definition.cancelOn?.some(
        ref => ref.name === event.eventName && ref.version === event.eventVersion,
      ),
    );
  }

  /** Newest live instance for a key, whatever step it is parked on. */
  private async findTarget(
    sagaKey: string,
    correlationKey: string,
  ): Promise<SagaInstanceRecord | null> {
    const live = await this.instances.findLiveByKey(sagaKey, correlationKey);
    return live[0] ?? null;
  }

  private mapContext(
    mapping: Record<string, string> | undefined,
    scope: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!mapping) {
      return {};
    }
    const mapped: Record<string, unknown> = {};
    for (const [field, expression] of Object.entries(mapping)) {
      mapped[field] = evaluateExpression(expression, scope);
    }
    return mapped;
  }
}
