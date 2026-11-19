import { Injectable, Logger } from '@nestjs/common';
import { SagaInstanceStatus, SagaStepKind, SagaStepRecord } from '../types/saga.types';
import { SagaActionResolverPort } from '../ports/saga-action.port';
import { SagaCommandPublisherPort } from '../ports/saga-command.port';
import { PrismaSagaInstanceRepository } from '../repositories/prisma-saga-instance.repository';
import { PrismaSagaStepRepository } from '../repositories/prisma-saga-step.repository';
import { SettleStepFailureUseCase } from './settle-step-failure.usecase';

const LIVE_STATUSES: ReadonlySet<SagaInstanceStatus> = new Set([
  SagaInstanceStatus.RUNNING,
  SagaInstanceStatus.WAITING,
  SagaInstanceStatus.COMPENSATING,
]);

/**
 * Use case: turn one claimed `saga_steps` row into a broker command.
 *
 * The saga does not call business actions itself. It publishes
 * `saga.command` with everything the consumer needs (tenant, company, action,
 * input, `idempotencyKey = step row id`) and stops. The outcome comes back as a
 * `saga.step.result` event, which `SettleSagaStepResultUseCase` applies.
 *
 * The action is only *resolved* here to fail fast with a clear error when a
 * definition references an action nobody registered — it is never invoked, so
 * execution can be moved to another process by giving the command queue its own
 * deployment.
 */
@Injectable()
export class ExecuteSagaStepUseCase {
  private readonly logger = new Logger(ExecuteSagaStepUseCase.name);

  constructor(
    private readonly steps: PrismaSagaStepRepository,
    private readonly instances: PrismaSagaInstanceRepository,
    private readonly actions: SagaActionResolverPort,
    private readonly commandPublisher: SagaCommandPublisherPort,
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

    if (!step.action || !this.actions.has(step.action)) {
      const error = `Saga action "${step.action ?? '(none)'}" is not registered`;
      this.logger.error(`Saga ${instance.sagaKey}: ${error}`);
      await this.steps.markFailed(step.id, error);
      await this.settleFailure.execute(instance.id, step.stepId, step.kind, error);
      return;
    }

    await this.commandPublisher.dispatch({
      tenantId: instance.tenantId,
      companyId: instance.companyId,
      sagaKey: instance.sagaKey,
      instanceId: instance.id,
      stepId: step.stepId,
      stepRowId: step.id,
      kind: step.kind === SagaStepKind.UNDO ? SagaStepKind.UNDO : SagaStepKind.DO,
      action: step.action,
      correlationKey: instance.correlationKey,
      input: step.input ?? {},
      doOutput: step.kind === SagaStepKind.UNDO ? (step.input ?? {}) : undefined,
    });
  }
}
