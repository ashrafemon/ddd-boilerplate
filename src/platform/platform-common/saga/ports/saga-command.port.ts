import { SagaStepCommand, SagaStepResult } from '../types/saga-command.types';

/**
 * Outbound port: publish one step command to the broker.
 *
 * The saga decides *what* must happen and in which order; the broker carries the
 * message and a business consumer performs the work. Nothing in the saga calls a
 * business action directly, so an action may live in another process.
 */
export abstract class SagaCommandPublisherPort {
  abstract dispatch(command: SagaStepCommand): Promise<void>;
}

/**
 * Outbound port: report the outcome of a command back to the saga.
 *
 * Implemented by the broker adapter (used by the command consumer) and by
 * nothing else — the saga settles a step only from a delivered result.
 */
export abstract class SagaStepResultPublisherPort {
  abstract publish(result: SagaStepResult): Promise<void>;
}
