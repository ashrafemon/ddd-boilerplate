import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import {
  SagaActionContext,
  SagaActionResult,
  SagaInstanceRecord,
  SagaInstanceStatus,
  SagaStepKind,
  SagaStepRecord,
  SagaUndoResult,
} from '../types/saga.types';
import { SagaActionResolverPort } from '../outbound/ports/saga-action.port';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';
import { SettleStepFailureUseCase } from './settle-step-failure.usecase';
import { SettleStepSuccessUseCase } from './settle-step-success.usecase';

const LIVE_STATUSES: ReadonlySet<SagaInstanceStatus> = new Set([
  SagaInstanceStatus.RUNNING,
  SagaInstanceStatus.WAITING,
  SagaInstanceStatus.COMPENSATING,
]);

/**
 * Use case: execute one claimed `saga_steps` row.
 *
 * The action runs inside the instance's request context; an unexpected throw is
 * treated as `retry`, and every terminal decision is a CAS write. The step row id
 * is handed to the action as its idempotency key, so a lease-expiry re-run
 * cannot double-apply business work.
 */
@Injectable()
export class ExecuteSagaStepUseCase {
  private readonly logger = new Logger(ExecuteSagaStepUseCase.name);

  constructor(
    private readonly steps: SagaStepRepositoryPort,
    private readonly instances: SagaInstanceRepositoryPort,
    private readonly actions: SagaActionResolverPort,
    private readonly requestContext: RequestContextPort,
    private readonly configService: ConfigService,
    private readonly settleSuccess: SettleStepSuccessUseCase,
    private readonly settleFailure: SettleStepFailureUseCase,
  ) {}

  async execute(step: SagaStepRecord): Promise<void> {
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
        companyId: instance.companyId,
        correlationId: instance.id,
      },
      () => this.run(step, instance),
    );
  }

  private async run(step: SagaStepRecord, instance: SagaInstanceRecord): Promise<void> {
    const action = step.action ? this.actions.resolve(step.action) : null;
    if (!action) {
      const error = `Saga action "${step.action ?? '(none)'}" is not registered`;
      this.logger.error(`Saga ${instance.sagaKey}: ${error}`);
      await this.steps.markFailed(step.id, error);
      await this.settleFailure.execute(instance.id, step.stepId, step.kind, error);
      return;
    }

    const context: SagaActionContext = {
      tenantId: instance.tenantId,
      companyId: instance.companyId,
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
      await this.settleSuccess.execute(instance.id, step.stepId, step.kind);
      return;
    }

    if (result.outcome === 'retry') {
      const attempts = step.attempts + 1;
      if (attempts < step.maxAttempts) {
        await this.steps.reschedule(
          step.id,
          attempts,
          new Date(Date.now() + this.backoffMs(attempts)),
          result.error ?? null,
        );
        return;
      }
    }

    const error = result.error ?? 'Saga action failed';
    await this.steps.markFailed(step.id, error);
    await this.settleFailure.execute(instance.id, step.stepId, step.kind, error);
  }

  private backoffMs(attempts: number): number {
    const { retryBaseDelayMs, retryMaxDelayMs } = this.configService.getSaga();
    return Math.min(retryBaseDelayMs * 2 ** (attempts - 1), retryMaxDelayMs);
  }
}
