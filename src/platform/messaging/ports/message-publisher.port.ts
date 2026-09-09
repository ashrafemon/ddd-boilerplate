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

export abstract class MessagePublisher {
  abstract publish(message: IntegrationMessage): Promise<void>;
}
