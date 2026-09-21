import {
  StartSagaRequest,
  HandleSagaEventRequest,
  SuspendSagaRequest,
  CompensateSagaRequest,
  SagaInstance,
} from '../saga.types';

/**
 * Saga — public orchestrator port.
 *
 * Business modules consume only SagaPort.
 * They do not consume SagaRepositoryPort or SagaCommandPort directly.
 */
export abstract class SagaPort {
  /** Start a new saga instance from a trigger event. */
  abstract start(request: StartSagaRequest): Promise<SagaInstance>;

  /** Handle an incoming event for an existing saga instance. */
  abstract handleEvent(request: HandleSagaEventRequest): Promise<void>;

  /** Suspend a running saga instance. */
  abstract suspend(request: SuspendSagaRequest): Promise<void>;

  /** Trigger compensation for a failed step. */
  abstract compensate(request: CompensateSagaRequest): Promise<void>;
}
