import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { OutboxEnvelope } from '@platform/outbox/outbox.types';
import {
  SagaCompanyConfigRepository,
  SagaDefinitionRepository,
  SagaInstanceRepository,
} from '../repositories/prisma-saga.repository';
import {
  SagaDefinitionRecord,
  SagaInstanceRecord,
  SagaInstanceReason,
  SagaTriggerEvent,
} from '../saga.types';
import { CompanySettingsReader } from '../ports/company-settings.port';
import { FeatureGate } from '../ports/feature-gate.port';
import { SagaInboundPort } from '../ports/saga-inbound.port';
import { evaluateCondition, evaluateExpression, renderTemplate } from './expression';
import { PlanBuilder } from './plan-builder';
import { SagaEngine } from './saga-engine';

const MAX_INSTANCES_PER_EVENT = 100;

/**
 * SagaRouter — the only place a saga starts.
 *
 * Five checks, in order, as the design says: ...
 *   1. `requires` + policy — does this saga/step exist for this company?
 *      (PlanBuilder filters; a required feature that is missing means no saga.)
 *   2. overlay — allowed? (conditions AND-combined, disabled steps dropped)
 *   3. `if` — relevant right now? (evaluated when the step is reached)
 *   4. `when` — is this the event? (start filter and WAIT per-event filter)
 *   5. `match` — does the event's correlation key equal the instance key?
 *
 * Loop guard: the saga's own emitted events (`aggregateType = 'Saga'`) never
 * re-enter the router.
 */
@Injectable()
export class SagaRouter extends SagaInboundPort {
  private readonly logger = new Logger(SagaRouter.name);

  constructor(
    private readonly definitions: SagaDefinitionRepository,
    private readonly configs: SagaCompanyConfigRepository,
    private readonly instances: SagaInstanceRepository,
    private readonly planBuilder: PlanBuilder,
    private readonly engine: SagaEngine,
    private readonly featureGate: FeatureGate,
    private readonly settings: CompanySettingsReader,
    private readonly requestContext: RequestContextPort,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async accept(envelope: OutboxEnvelope): Promise<void> {
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

    const active = await this.definitions.listActive();
    for (const definition of active) {
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

    const plan = this.planBuilder.build({
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
    const context: Record<string, unknown> = {
      settings,
      event: event.payload,
      start: this.mapContext(spec.context, triggerScope),
    };

    const instance = await this.engine.createAndAdvance({
      tenantId: event.tenantId,
      companyId: event.companyId,
      sagaKey: definition.sagaKey,
      definitionId: definition.id,
      configId: null,
      rootRefType: null,
      rootRefId: null,
      correlationKey,
      plan,
      context,
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
      await this.engine.cancel(instance.id, SagaInstanceReason.CANCELLED_BY_EVENT);
    }
  }

  private async routeWait(
    definition: SagaDefinitionRecord,
    event: SagaTriggerEvent,
  ): Promise<void> {
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
      await this.engine.bufferForInstance(
        instance,
        event.eventId,
        event.eventName,
        event.eventVersion,
        event.payload,
      );
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
