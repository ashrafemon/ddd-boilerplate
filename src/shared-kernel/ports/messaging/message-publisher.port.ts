import { IntegrationMessage } from './integration-message';

/**
 * Publishes integration messages to the configured message transports
 * (RabbitMQ / Kafka / SQS). The implementation is the CompositeMessagePublisher
 * which fans out to every enabled transport.
 */
export abstract class MessagePublisherPort {
  public abstract publish(message: IntegrationMessage): Promise<void>;
  public abstract publishAll(messages: IntegrationMessage[]): Promise<void>;
}
