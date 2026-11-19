import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import {
  SagaInstanceRecord,
  SagaInstanceStatus,
  SagaStepKind,
  SagaStepStatus,
} from '../types/saga.types';
import { evaluateCondition, parseDuration, renderTemplate } from '../types/saga-expression';
import { buildInput, buildScope } from '../types/saga-scope';
import { PrismaSagaInstanceRepository } from '../repositories/prisma-saga-instance.repository';
import { SagaInboxPort } from '@platform/platform-common/saga-inbox/ports/saga-inbox.port';
import { PrismaSagaStepRepository } from '../repositories/prisma-saga-step.repository';
import { CompleteSagaUseCase } from './complete-saga.usecase';

export const TERMINAL_INSTANCE_STATUSES: ReadonlySet<SagaInstanceStatus> = new Set([
  SagaInstanceStatus.COMPLETED,
  SagaInstanceStatus.COMPENSATED,
  SagaInstanceStatus.CANCELLED,
  SagaInstanceStatus.FAILED_MANUAL,
]);

/**
 * Use case: walk the frozen plan forward from the instance cursor.
 *
 * It bypasses steps whose `if` is false, consumes a buffered event for a WAIT
 * step, or enqueues the next DO step in `saga_steps` and stops. Business work
 * never happens here — that is the step worker's job — so an advance is cheap,
 * retry-safe and identical on a resumed instance.
 */
@Injectable()
export class AdvanceSagaUseCase {
  constructor(
    private readonly instances: PrismaSagaInstanceRepository,
    private readonly steps: PrismaSagaStepRepository,
    private readonly inbox: SagaInboxPort,
    private readonly configService: ConfigService,
    private readonly completeSaga: CompleteSagaUseCase,
  ) {}

  async execute(instanceId: string): Promise<SagaInstanceRecord | null> {
    const instance = await this.instances.findById(instanceId);
    if (!instance || TERMINAL_INSTANCE_STATUSES.has(instance.status)) {
      return instance;
    }
    if (instance.status === SagaInstanceStatus.COMPENSATING) {
      return instance;
    }

    const plan = instance.plan;
    const scope = buildScope(instance, await this.steps.findByInstance(instance.id));
    const now = new Date();
    let cursor = instance.cursor;

    while (cursor < plan.steps.length) {
      const step = plan.steps[cursor];

      if (step.if && !evaluateCondition(step.if, scope)) {
        await this.steps.createIfAbsent({
          tenantId: instance.tenantId,
          companyId: instance.companyId,
          instanceId: instance.id,
          stepId: step.id,
          kind: step.kind === SagaStepKind.WAIT ? SagaStepKind.WAIT : SagaStepKind.DO,
          action: step.action ?? null,
          eventName: step.waitFor?.name ?? null,
          eventVersion: step.waitFor?.version ?? null,
          status: SagaStepStatus.SKIPPED,
          maxAttempts: step.maxAttempts,
          runAt: now,
        });
        cursor += 1;
        continue;
      }

      if (step.kind === SagaStepKind.WAIT) {
        if (step.waitFor) {
          const buffered = await this.inbox.listBuffered(
            instance.id,
            step.waitFor.name,
            step.waitFor.version,
            50,
          );
          let consumedEventId: string | null = null;
          for (const row of buffered) {
            const eventScope = { ...scope, event: row.payload };
            if (step.match && renderTemplate(step.match, eventScope) !== instance.correlationKey) {
              continue;
            }
            if (step.when && !evaluateCondition(step.when, eventScope)) {
              continue;
            }
            await this.steps.createIfAbsent({
              tenantId: instance.tenantId,
              companyId: instance.companyId,
              instanceId: instance.id,
              stepId: step.id,
              kind: SagaStepKind.WAIT,
              action: null,
              eventName: step.waitFor.name,
              eventVersion: step.waitFor.version,
              status: SagaStepStatus.DONE,
              maxAttempts: step.maxAttempts,
              runAt: now,
              output: { eventId: row.eventId },
            });
            // The step row is written first (idempotent on `(instanceId, stepId)`), so a
            // crash before this CAS leaves the delivery buffered and retryable. Losing the
            // CAS means a concurrent worker matched the same delivery — the step row and
            // the completion are both idempotent, so the outcome is identical.
            await this.inbox.markConsumed(row.id);
            consumedEventId = row.eventId;
            break;
          }
          if (consumedEventId) {
            scope.steps[step.id] = {
              status: SagaStepStatus.DONE,
              output: { eventId: consumedEventId },
            };
            cursor += 1;
            continue;
          }
        }
        const timeoutMs = step.timeout
          ? parseDuration(step.timeout)
          : this.configService.getSaga().workerLeaseSeconds * 1000;
        await this.steps.createIfAbsent({
          tenantId: instance.tenantId,
          companyId: instance.companyId,
          instanceId: instance.id,
          stepId: step.id,
          kind: SagaStepKind.WAIT,
          action: null,
          eventName: step.waitFor?.name ?? null,
          eventVersion: step.waitFor?.version ?? null,
          status: SagaStepStatus.PENDING,
          maxAttempts: step.maxAttempts,
          runAt: new Date(now.getTime() + timeoutMs),
        });
        return this.instances.updateCas(instance.id, instance.version, {
          cursor,
          status: SagaInstanceStatus.WAITING,
          waitingEvent: `${step.waitFor?.name}@${step.waitFor?.version}`,
        });
      }

      const input = buildInput(step, scope);
      const created = await this.steps.createIfAbsent({
        tenantId: instance.tenantId,
        companyId: instance.companyId,
        instanceId: instance.id,
        stepId: step.id,
        kind: SagaStepKind.DO,
        action: step.action ?? null,
        status: SagaStepStatus.PENDING,
        maxAttempts: step.maxAttempts,
        runAt: now,
        input,
      });
      if (created.status === SagaStepStatus.DONE) {
        scope.steps[step.id] = { status: SagaStepStatus.DONE, output: created.output ?? {} };
        cursor += 1;
        continue;
      }
      if (created.status === SagaStepStatus.SKIPPED) {
        cursor += 1;
        continue;
      }
      // Hand the durable DO step to the worker.
      return this.instances.updateCas(instance.id, instance.version, {
        cursor,
        status: SagaInstanceStatus.RUNNING,
        waitingEvent: null,
      });
    }

    return this.completeSaga.execute(instance, cursor);
  }
}
