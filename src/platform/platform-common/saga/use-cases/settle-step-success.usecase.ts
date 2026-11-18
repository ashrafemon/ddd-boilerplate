import { Injectable } from '@nestjs/common';
import { SagaInstanceStatus, SagaStepKind } from '../types/saga.types';
import { failedUndoError } from '../types/saga-scope';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';
import { AdvanceSagaUseCase } from './advance-saga.usecase';
import { hasPendingUndo, isTerminal } from './start-compensation.usecase';

/**
 * Use case: settle a step that finished with `ok`.
 *
 * A DO success moves the cursor past the step and continues the walk; an UNDO
 * success closes the compensation once no UNDO row is left, carrying the first
 * undo error into the terminal row so a compensated saga still explains itself.
 */
@Injectable()
export class SettleStepSuccessUseCase {
  constructor(
    private readonly instances: SagaInstanceRepositoryPort,
    private readonly steps: SagaStepRepositoryPort,
    private readonly advanceSaga: AdvanceSagaUseCase,
  ) {}

  async execute(instanceId: string, stepId: string, kind: SagaStepKind): Promise<void> {
    const instance = await this.instances.findById(instanceId);
    if (!instance || isTerminal(instance)) {
      return;
    }

    if (kind === SagaStepKind.UNDO) {
      if (instance.status !== SagaInstanceStatus.COMPENSATING) {
        return;
      }
      const rows = await this.steps.findByInstance(instance.id);
      if (hasPendingUndo(rows)) {
        return;
      }
      await this.instances.updateCas(instance.id, instance.version, {
        status: SagaInstanceStatus.COMPENSATED,
        lastError: failedUndoError(rows) ?? instance.lastError,
      });
      return;
    }

    const index = instance.plan.steps.findIndex(step => step.id === stepId);
    if (index === -1) {
      return;
    }
    await this.instances.updateCas(instance.id, instance.version, { cursor: index + 1 });
    await this.advanceSaga.execute(instance.id);
  }
}
