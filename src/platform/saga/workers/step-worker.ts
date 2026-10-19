import { Injectable, Logger } from '@nestjs/common';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { SagaInstanceRepository, SagaStepRepository } from '../repositories/prisma-saga.repository';
import {
  SagaActionResult,
  SagaActionContext,
  SagaInstanceRecord,
  SagaInstanceStatus,
  SagaStepKind,
  SagaStepRecord,
  SagaUndoResult,
} from '../saga.types';
import { SagaActionRegistry } from '../application/saga-action.registry';
import { SagaEngine } from '../application/saga-engine';

const LIVE_STATUSES: ReadonlySet<SagaInstanceStatus> = new Set([
  SagaInstanceStatus.RUNNING,
  SagaInstanceStatus.WAITING,
  SagaInstanceStatus.COMPENSATING,
]);

/**
 * SagaStepWorker — claims due `saga_steps` rows (SKIP LOCKED + lease), runs the
 * registered `SagaAction`, and settles the step. Every settle is a CAS write, so
 * a redelivery re-runs the action (the action is idempotent on the step row id)
 * but never double-applies the step outcome.
 */
@Injectable()
export class SagaStepWorker {
  private readonly logger = new Logger(SagaStepWorker.name);
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID()}`;

  constructor(
    private readonly steps: SagaStepRepository,
    private readonly instances: SagaInstanceRepository,
    private readonly actions: SagaActionRegistry,
    private readonly engine: SagaEngine,
    private readonly requestContext: RequestContextPort,
    private readonly configService: ConfigService,
  ) {}

  async runBatch(): Promise<number> {
    const config = this.configService.getSaga();
    const claimed = await this.steps.claimBatch({
      now: new Date(),
      leaseMs: config.workerLeaseSeconds * 1000,
      batchSize: config.claimBatchSize,
      workerId: this.workerId,
      fairnessCap: config.fairnessCap,
    });

    for (const step of claimed) {
      await this.execute(step);
    }
    return claimed.length;
  }

  private async execute(step: SagaStepRecord): Promise<void> {
    const instance = await this.instances.findById(step.instanceId);
    if (!instance) {
      await this.steps.markFailed(step.id, 'instance missing');
      return;
    }
    if (!LIVE_STATUSES.has(instance.status)) {
      await this.steps.markSkipped(step.id);
      return;
    }
    await this.requestContext.run(
      {
        tenantId: instance.tenantId,
        organizationId: instance.organizationId,
        correlationId: instance.id,
      },
      () => this.run(step, instance),
    );
  }

  private async run(step: SagaStepRecord, instance: SagaInstanceRecord): Promise<void> {
    const action = step.action ? this.actions.resolve(step.action) : null;
    if (!action) {
      const error = `Saga action "${step.action ?? '(none)'}" is not registered`;
      await this.steps.markFailed(step.id, error);
      await this.settleFailure(step, instance, error);
      return;
    }

    const context: SagaActionContext = {
      tenantId: instance.tenantId,
      organizationId: instance.organizationId,
      sagaKey: instance.sagaKey,
      instanceId: instance.id,
      stepId: step.stepId,
      idempotencyKey: step.id,
      correlationKey: instance.correlationKey,
      input: step.input ?? {},
    };

    let result: SagaActionResult | SagaUndoResult;
    try {
      result =
        step.kind === SagaStepKind.UNDO
          ? await action.undo({ ...context, doOutput: step.input ?? {} })
          : await action.do(context);
    } catch (err) {
      // An unexpected throw is retried, exactly like an explicit `retry`.
      result = { outcome: 'retry', error: (err as Error).message };
    }

    await this.settle(step, instance, result);
  }

  private async settle(
    step: SagaStepRecord,
    instance: SagaInstanceRecord,
    result: SagaActionResult | SagaUndoResult,
  ): Promise<void> {
    if (result.outcome === 'ok') {
      const output = 'output' in result ? (result.output ?? null) : null;
      await this.steps.markDone(step.id, output);
      if (step.kind === SagaStepKind.UNDO) {
        await this.engine.onUndoSucceeded(instance.id, step.stepId);
      } else {
        await this.engine.onDoSucceeded(instance.id, step.stepId);
      }
      return;
    }

    if (result.outcome === 'retry') {
      const attempt = step.attempt + 1;
      if (attempt < step.maxAttempts) {
        await this.steps.reschedule(
          step.id,
          attempt,
          new Date(Date.now() + this.backoffMs(attempt)),
          result.error ?? null,
        );
        return;
      }
    }

    await this.steps.markFailed(step.id, result.error ?? 'Saga action failed');
    await this.settleFailure(step, instance, result.error ?? 'Saga action failed');
  }

  private async settleFailure(
    step: SagaStepRecord,
    instance: SagaInstanceRecord,
    error: string,
  ): Promise<void> {
    if (step.kind === SagaStepKind.UNDO) {
      await this.engine.onUndoFailed(instance.id, step.stepId, error);
      return;
    }
    await this.engine.onDoFailed(instance.id, step.stepId, error);
  }

  private backoffMs(attempt: number): number {
    const { retryBaseDelayMs, retryMaxDelayMs } = this.configService.getSaga();
    return Math.min(retryBaseDelayMs * 2 ** (attempt - 1), retryMaxDelayMs);
  }
}

/** Exported for the sweep: a claim that outlived its lease. */
export const STALE_LEASE_ERROR = 'lease expired before the step settled';
