import { Injectable } from '@nestjs/common';
import { SagaInstanceReason, SagaInstanceStatus, SagaStepRecord } from '../types/saga.types';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';
import { AdvanceSagaUseCase } from './advance-saga.usecase';
import { StartCompensationUseCase, isTerminal } from './start-compensation.usecase';

/**
 * Use case: settle a WAIT step whose timeout instant passed with no event.
 *
 * `onTimeout` decides the default: `skip` (continue the plan) or `compensate`
 * (reverse what happened). Either way the WAIT row is marked FAILED so the sweep
 * never sees it again.
 */
@Injectable()
export class ExpireWaitStepUseCase {
  constructor(
    private readonly instances: SagaInstanceRepositoryPort,
    private readonly steps: SagaStepRepositoryPort,
    private readonly advanceSaga: AdvanceSagaUseCase,
    private readonly compensate: StartCompensationUseCase,
  ) {}

  async execute(stepRow: SagaStepRecord): Promise<void> {
    const instance = await this.instances.findById(stepRow.instanceId);
    if (!instance || isTerminal(instance)) {
      return;
    }
    const planStep = instance.plan.steps.find(step => step.id === stepRow.stepId);
    await this.steps.markFailed(stepRow.id, `WAIT step "${stepRow.stepId}" timed out`);

    const index = instance.plan.steps.findIndex(step => step.id === stepRow.stepId);

    if (planStep?.onTimeout === 'compensate') {
      await this.compensate.execute(
        instance,
        index === -1 ? instance.cursor : index,
        SagaInstanceReason.TIMEOUT,
        `WAIT step "${stepRow.stepId}" timed out`,
      );
      return;
    }

    // Default: skip the wait and keep going (bypass means continue, never wait).
    await this.instances.updateCas(instance.id, instance.version, {
      cursor: index === -1 ? instance.cursor : index + 1,
      waitingEvent: null,
      status: SagaInstanceStatus.RUNNING,
    });
    await this.advanceSaga.execute(instance.id);
  }
}
