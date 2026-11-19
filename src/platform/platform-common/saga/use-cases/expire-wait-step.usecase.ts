import { Injectable } from '@nestjs/common';
import { SagaInstanceReason, SagaInstanceStatus, SagaStepRecord } from '../types/saga.types';
import { SagaInboxPort } from '@platform/platform-common/saga-inbox/ports/saga-inbox.port';
import { PrismaSagaInstanceRepository } from '../repositories/prisma-saga-instance.repository';
import { PrismaSagaStepRepository } from '../repositories/prisma-saga-step.repository';
import { AdvanceSagaUseCase } from './advance-saga.usecase';
import { StartCompensationUseCase, isTerminal } from './start-compensation.usecase';

/**
 * Use case: settle a WAIT step whose timeout instant passed with no event.
 *
 * `onTimeout` decides the default: `skip` (continue the plan) or `compensate`
 * (reverse what happened). Either way the WAIT row is marked FAILED so the sweep
 * never sees it again. A skipped wait can no longer consume its buffered
 * deliveries, so they are parked IGNORED with the reason — the ledger stays
 * truthful instead of holding rows nobody will ever read.
 */
@Injectable()
export class ExpireWaitStepUseCase {
  constructor(
    private readonly instances: PrismaSagaInstanceRepository,
    private readonly steps: PrismaSagaStepRepository,
    private readonly advanceSaga: AdvanceSagaUseCase,
    private readonly compensate: StartCompensationUseCase,
    private readonly inbox: SagaInboxPort,
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
    if (stepRow.eventName && stepRow.eventVersion !== null) {
      await this.inbox.ignoreBuffered(
        instance.id,
        stepRow.eventName,
        stepRow.eventVersion,
        `WAIT step "${stepRow.stepId}" timed out and was skipped`,
      );
    }
    await this.instances.updateCas(instance.id, instance.version, {
      cursor: index === -1 ? instance.cursor : index + 1,
      waitingEvent: null,
      status: SagaInstanceStatus.RUNNING,
    });
    await this.advanceSaga.execute(instance.id);
  }
}
