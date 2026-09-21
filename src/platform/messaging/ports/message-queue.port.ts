import {
  MessageQueuePublishRequest,
  MessageQueuePublishResult,
  MessageQueueSubscribeRequest,
  MessageQueueSubscription,
  MessageQueueAckRequest,
  MessageQueueNackRequest,
} from '../message-queue.types';

/**
 * Platform-level message queue abstraction for asynchronous
 * command/work/message delivery.
 *
 * Business modules never call RabbitMQ/Kafka directly.
 * The Outbox Dispatcher publishes through MessageQueuePort.
 * Consumer adapters subscribe through MessageQueuePort.
 */
export abstract class MessageQueuePort {
  /** Publish a message to a queue/exchange. */
  abstract publish(
    request: MessageQueuePublishRequest,
  ): Promise<MessageQueuePublishResult>;

  /** Subscribe to messages on a queue/exchange. */
  abstract subscribe(
    request: MessageQueueSubscribeRequest,
  ): Promise<MessageQueueSubscription>;

  /** Acknowledge a successfully processed message. */
  abstract ack(request: MessageQueueAckRequest): Promise<void>;

  /** Negatively acknowledge a message (optionally requeue). */
  abstract nack(request: MessageQueueNackRequest): Promise<void>;
}
