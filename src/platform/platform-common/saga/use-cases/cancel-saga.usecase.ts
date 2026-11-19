import { Injectable } from '@nestjs/common';
import {
  SagaInstanceReason,
  SagaInstanceStatus,
  SagaStepKind,
  SagaStepStatus,
} from '../types/saga.types';
import { PrismaSagaInstanceRepository } from '../repositories/prisma-saga-instance.repository';
import { PrismaSagaStepRepository } from '../repositories/prisma-saga-step.repository';
import { StartCompensationUseCase, isTerminal } from './start-compensation.usecase';

/**
 * Use case: cancel a live saga (cancel event or user request).
 *
 * Cancelling before any DO step completed is terminal on its own; once business
 * work happened, cancel means compensate — never "stop and leave the work".
 */
@Injectable()
export class CancelSagaUseCase {
  constructor(
    private readonly instances: PrismaSagaInstanceRepository,
    private readonly steps: PrismaSagaStepRepository,
    private readonly compensate: StartCompensationUseCase,
  ) {}

  async execute(instanceId: string, reason: SagaInstanceReason): Promise<void> {
    const instance = await this.instances.findById(instanceId);
    if (!instance || isTerminal(instance)) {
      return;
    }
    const rows = await this.steps.findByInstance(instance.id);
    const hasCompletedDo = rows.some(
      row => row.kind === SagaStepKind.DO && row.status === SagaStepStatus.DONE,
    );
    if (!hasCompletedDo) {
      await this.instances.updateCas(instance.id, instance.version, {
        status: SagaInstanceStatus.CANCELLED,
        reason,
      });
      return;
    }
    await this.compensate.execute(instance, instance.cursor, reason, `Cancelled: ${reason}`);
  }
}
