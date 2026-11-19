import { Injectable } from '@nestjs/common';
import { SagaInstanceReason, SagaInstanceStatus, SagaStepKind } from '../types/saga.types';
import { PrismaSagaInstanceRepository } from '../repositories/prisma-saga-instance.repository';
import { StartCompensationUseCase, isTerminal } from './start-compensation.usecase';

/**
 * Use case: settle a step that failed permanently (retries exhausted or `fail`).
 *
 * A failed DO starts compensation from that step; a failed UNDO parks the
 * instance `FAILED_MANUAL` — a reversal that cannot be reversed needs a human,
 * and retrying it forever would hide the problem.
 */
@Injectable()
export class SettleStepFailureUseCase {
  constructor(
    private readonly instances: PrismaSagaInstanceRepository,
    private readonly compensate: StartCompensationUseCase,
  ) {}

  async execute(
    instanceId: string,
    stepId: string,
    kind: SagaStepKind,
    error: string,
    reason: SagaInstanceReason = SagaInstanceReason.STEP_FAILED,
  ): Promise<void> {
    const instance = await this.instances.findById(instanceId);
    if (!instance || isTerminal(instance)) {
      return;
    }

    if (kind === SagaStepKind.UNDO) {
      await this.instances.updateCas(instance.id, instance.version, {
        status: SagaInstanceStatus.FAILED_MANUAL,
        lastError: error,
      });
      return;
    }

    const index = instance.plan.steps.findIndex(step => step.id === stepId);
    if (index === -1) {
      return;
    }
    await this.compensate.execute(instance, index, reason, error);
  }
}
