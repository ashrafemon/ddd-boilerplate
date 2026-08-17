/**
 * External message publishing port. Implemented by RabbitMQ/Kafka adapters.
 * Business code never touches the broker libraries directly.
 */
export abstract class MessagePublisher {
  abstract publish(message: IntegrationMessage): Promise<void>;
}

export interface IntegrationMessage {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  occurredAt: Date;
  correlationId?: string;
  causationId?: string;
}
