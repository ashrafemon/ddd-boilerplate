import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { SagaStepResult } from '../types/saga-command.types';
import { SagaStepStatus } from '../types/saga.types';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';
import { SettleStepFailureUseCase } from './settle-step-failure.usecase';
import { SettleStepSuccessUseCase } from './settle-step-success.usecase';

/**
 * Use case: apply one `saga.step.result` delivered from the broker.
 *
 * This is where the saga learns what happened — never from a return value of the
 * action. Three outcomes, mirrored from the action contract:
 *
 *   ok    → `markDone(output)` and continue the plan
 *   retry → `reschedule` with exponential backoff until `maxAttempts`
 *   fail  → `markFailed` and start compensation
 *
 * Every write is a CAS on the step row, so a duplicated result message (broker
 * redelivery) cannot settle the same row twice.
 */
@Injectable()
export class SettleSagaStepResultUseCase {
  private readonly logger = new Logger(SettleSagaStepResultUseCase.name);

  constructor(
    private readonly steps: SagaStepRepositoryPort,
    private readonly settleSuccess: SettleStepSuccessUseCase,
    private readonly settleFailure: SettleStepFailureUseCase,
    private readonly configService: ConfigService,
  ) {}

  async execute(result: SagaStepResult): Promise<void> {
    const step = await this.steps.findById(result.stepRowId);
    if (!step) {
      this.logger.warn(`Result for unknown saga step ${result.stepRowId} ignored`);
      return;
    }
    if (step.status !== SagaStepStatus.RUNNING) {
      this.logger.debug(
        `Duplicate result for step ${step.stepId} (${step.status}) ignored — already settled`,
      );
      return;
    }

    if (result.outcome === 'ok') {
      await this.steps.markDone(step.id, result.output ?? null);
      await this.settleSuccess.execute(step.instanceId, step.stepId, step.kind);
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
    await this.settleFailure.execute(step.instanceId, step.stepId, step.kind, error);
  }

  private backoffMs(attempts: number): number {
    const { retryBaseDelayMs, retryMaxDelayMs } = this.configService.getSaga();
    return Math.min(retryBaseDelayMs * 2 ** (attempts - 1), retryMaxDelayMs);
  }
}
