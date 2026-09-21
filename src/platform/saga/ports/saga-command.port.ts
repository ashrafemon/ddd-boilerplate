import { SagaCommandDispatchRequest, SagaCommandDispatchResult } from '../saga.types';

/**
 * Saga command dispatch port.
 *
 * The Saga dispatches commands through this port — never directly to
 * business services. The adapter determines whether the command is
 * delivered via application use case, RabbitMQ, gRPC, HTTP, or Kafka.
 */
export abstract class SagaCommandPort {
  abstract dispatch(request: SagaCommandDispatchRequest): Promise<SagaCommandDispatchResult>;
}
