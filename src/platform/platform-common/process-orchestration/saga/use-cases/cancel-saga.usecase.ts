import { Injectable } from '@nestjs/common';
import {
  SagaInstanceReason,
  SagaInstanceStatus,
  SagaStepKind,
  SagaStepStatus,
} from '../types/saga.types';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';
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
    private readonly instances: SagaInstanceRepositoryPort,
    private readonly steps: SagaStepRepositoryPort,
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
