/**
 * The wire format of an integration message published by the outbox
 * dispatcher to Kafka/RabbitMQ/SQS.
 */
export interface IntegrationMessage {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  tenantId: string;
  organizationId?: string;
  correlationId?: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}
