import { IntegrationMessage } from './integration-message';

/**
 * Contract implemented by business modules that react to integration events.
 * Handlers are registered with the IntegrationMessageRouter and invoked from
 * message consumers (RabbitMQ/Kafka/SQS) after the tenant/organization
 * context has been restored in CLS.
 *
 * Handlers must be idempotent: the router guarantees at-least-once delivery
 * and deduplicates through the inbox.
 */
export abstract class IntegrationEventHandler {
  public abstract readonly eventType: string;

  public abstract handle(message: IntegrationMessage): Promise<void>;
}
