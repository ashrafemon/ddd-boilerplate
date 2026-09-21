import { randomUUID } from 'crypto';
import { MessageQueuePort } from '../ports/message-queue.port';
import {
  MessageQueuePublishRequest,
  MessageQueuePublishResult,
  MessageQueueSubscribeRequest,
  MessageQueueSubscription,
  MessageQueueAckRequest,
  MessageQueueNackRequest,
  MessageQueueMessage,
} from '../message-queue.types';

/**
 * In-memory Message Queue for unit tests. No broker dependencies.
 */
export class InMemoryMessageQueue implements MessageQueuePort {
  private readonly published: MessageQueuePublishRequest[] = [];
  private readonly subscriptions = new Map<string, MessageQueueSubscribeRequest>();
  private readonly acked: MessageQueueAckRequest[] = [];
  private readonly nacked: MessageQueueNackRequest[] = [];

  async publish(
    request: MessageQueuePublishRequest,
  ): Promise<MessageQueuePublishResult> {
    this.published.push(request);
    return { messageId: request.messageId, accepted: true };
  }

  async subscribe(
    request: MessageQueueSubscribeRequest,
  ): Promise<MessageQueueSubscription> {
    const subscriptionId = randomUUID();
    this.subscriptions.set(subscriptionId, request);

    return {
      subscriptionId,
      destination: request.destination,
      unsubscribe: async () => {
        this.subscriptions.delete(subscriptionId);
      },
    };
  }

  async ack(request: MessageQueueAckRequest): Promise<void> {
    this.acked.push(request);
  }

  async nack(request: MessageQueueNackRequest): Promise<void> {
    this.nacked.push(request);
  }

  /** Test helper: get all published requests. */
  getPublished(): readonly MessageQueuePublishRequest[] {
    return this.published;
  }

  /** Test helper: get all acked requests. */
  getAcked(): readonly MessageQueueAckRequest[] {
    return this.acked;
  }

  /** Test helper: get all nacked requests. */
  getNacked(): readonly MessageQueueNackRequest[] {
    return this.nacked;
  }

  /** Test helper: simulate delivering a message to a subscriber. */
  async deliver(
    subscriptionId: string,
    message: MessageQueueMessage,
  ): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      await sub.handler(message);
    }
  }

  /** Test helper: clear all recorded operations. */
  clear(): void {
    this.published.length = 0;
    this.acked.length = 0;
    this.nacked.length = 0;
  }
}
