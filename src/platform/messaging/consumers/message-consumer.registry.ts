import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MessageQueueSubscribeRequest, MessageQueueSubscription } from '../message-queue.types';

/**
 * Registry for active message queue subscriptions. Tracks consumer lifecycle
 * and provides subscription management for the Message Queue module.
 */
@Injectable()
export class MessageConsumerRegistry {
  private readonly logger = new Logger(MessageConsumerRegistry.name);
  private readonly subscriptions = new Map<string, MessageQueueSubscription>();

  /** Register a new subscription. */
  register(subscription: MessageQueueSubscription): void {
    this.subscriptions.set(subscription.subscriptionId, subscription);
    this.logger.log(
      `Registered subscription ${subscription.subscriptionId} for ${subscription.destination}`,
    );
  }

  /** Unregister a subscription. */
  unregister(subscriptionId: string): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      this.subscriptions.delete(subscriptionId);
      this.logger.log(`Unregistered subscription ${subscriptionId}`);
    }
  }

  /** Get a subscription by ID. */
  get(subscriptionId: string): MessageQueueSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /** Get all active subscriptions. */
  getAll(): MessageQueueSubscription[] {
    return [...this.subscriptions.values()];
  }

  /** Get subscription count. */
  count(): number {
    return this.subscriptions.size;
  }

  /** Shutdown all subscriptions. */
  async shutdown(): Promise<void> {
    for (const [id, sub] of this.subscriptions) {
      try {
        await sub.unsubscribe();
      } catch (err) {
        this.logger.warn(`Failed to unsubscribe ${id}: ${err}`);
      }
    }
    this.subscriptions.clear();
  }
}
