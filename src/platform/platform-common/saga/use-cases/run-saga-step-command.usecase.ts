import { Injectable, Logger } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import {
  SagaActionContext,
  SagaActionResult,
  SagaStepKind,
  SagaStepStatus,
  SagaUndoResult,
} from '../types/saga.types';
import { SagaStepCommand } from '../types/saga-command.types';
import { SagaActionResolverPort } from '../ports/saga-action.port';
import { SagaStepResultPublisherPort } from '../ports/saga-command.port';
import { PrismaSagaStepRepository } from '../repositories/prisma-saga-step.repository';

/**
 * Use case (consumer side): run one delivered `saga.command`.
 *
 * The only place a `SAGA_ACTION` is invoked. It runs inside the saga command
 * consumer — never in the request that triggered the saga — and reports back by
 * publishing `saga.step.result`; the saga's state machine never sees a return
 * value.
 *
 * The step must still be `RUNNING`: a redelivered command whose row already
 * settled is ignored instead of repeating business work.
 */
@Injectable()
export class RunSagaStepCommandUseCase {
  private readonly logger = new Logger(RunSagaStepCommandUseCase.name);

  constructor(
    private readonly steps: PrismaSagaStepRepository,
    private readonly actions: SagaActionResolverPort,
    private readonly results: SagaStepResultPublisherPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(command: SagaStepCommand): Promise<void> {
    const step = await this.steps.findById(command.stepRowId);
    if (!step || step.status !== SagaStepStatus.RUNNING) {
      this.logger.warn(
        `Saga command ${command.action} ignored: step ${command.stepRowId} is not RUNNING`,
      );
      return;
    }

    const action = this.actions.resolve(command.action);
    if (!action) {
      await this.results.publish({
        tenantId: command.tenantId,
        companyId: command.companyId,
        instanceId: command.instanceId,
        stepId: command.stepId,
        stepRowId: command.stepRowId,
        kind: command.kind,
        outcome: 'fail',
        output: null,
        error: 'action not registered',
      });
      return;
    }

    const context: SagaActionContext = {
      tenantId: command.tenantId,
      companyId: command.companyId,
      sagaKey: command.sagaKey,
      instanceId: command.instanceId,
      stepId: command.stepId,
      idempotencyKey: command.stepRowId,
      correlationKey: command.correlationKey,
      input: command.input,
    };

    let result: SagaActionResult | SagaUndoResult;
    try {
      result = await this.requestContext.run(
        {
          tenantId: command.tenantId,
          companyId: command.companyId,
          correlationId: command.instanceId,
        },
        () =>
          command.kind === SagaStepKind.UNDO
            ? action.undo({ ...context, doOutput: command.doOutput ?? command.input })
            : action.do(context),
      );
    } catch (err) {
      // An unexpected throw is retried, exactly like an explicit `retry`.
      result = { outcome: 'retry', error: (err as Error).message };
    }

    await this.results.publish({
      tenantId: command.tenantId,
      companyId: command.companyId,
      instanceId: command.instanceId,
      stepId: command.stepId,
      stepRowId: command.stepRowId,
      kind: command.kind,
      outcome: result.outcome,
      output: 'output' in result ? (result.output ?? null) : null,
      error: result.error ?? null,
    });
  }
}
