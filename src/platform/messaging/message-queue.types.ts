/**
 * Message Queue types — publish, subscribe, ack/nack, consumer contracts.
 */

/** Request to publish a message to a queue/exchange. */
export interface MessageQueuePublishRequest {
  messageId: string;

  tenantId?: string | null;
  organizationId?: string | null;

  destination: string;
  messageType: string;
  messageVersion: number;

  payload: unknown;

  correlationId?: string;
  causationId?: string;
  headers?: Record<string, string>;
}

/** Result of a publish attempt. */
export interface MessageQueuePublishResult {
  messageId: string;
  accepted: boolean;
}

/** Message delivered to a consumer. */
export interface MessageQueueMessage {
  messageId: string;

  tenantId?: string | null;
  organizationId?: string | null;

  messageType: string;
  messageVersion: number;

  payload: unknown;

  correlationId?: string;
  causationId?: string;

  deliveryAttempt: number;
  receivedAt: Date;
}

/** Request to subscribe to a queue/exchange. */
export interface MessageQueueSubscribeRequest {
  destination: string;
  messageType: string;
  messageVersion: number;

  handler: (message: MessageQueueMessage) => Promise<void>;

  options?: {
    consumerGroup?: string;
    prefetch?: number;
  };
}

/** Handle returned for managing a subscription. */
export interface MessageQueueSubscription {
  subscriptionId: string;
  destination: string;
  unsubscribe(): Promise<void>;
}

/** Request to acknowledge a message. */
export interface MessageQueueAckRequest {
  messageId: string;
  subscriptionId: string;
}

/** Request to negatively acknowledge a message (requeue). */
export interface MessageQueueNackRequest {
  messageId: string;
  subscriptionId: string;
  requeue: boolean;
}

/** Message Queue configuration. */
export interface IMessageQueueConfig {
  provider: 'rabbitmq' | 'kafka' | 'sqs';
  publishTimeoutMs: number;
  consumerPrefetch: number;
  maxAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  connectionTimeoutMs: number;
  heartbeatSeconds: number;
}
