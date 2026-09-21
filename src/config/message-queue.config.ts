import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';
import { IMessageQueueConfig } from '@platform/messaging/message-queue.types';

/**
 * Message Queue configuration.
 */
export default registerAs('messageQueue', (): IMessageQueueConfig => ({
  provider: (process.env.MESSAGE_QUEUE_PROVIDER as IMessageQueueConfig['provider']) ?? 'rabbitmq',
  publishTimeoutMs: numericEnv('MESSAGE_QUEUE_PUBLISH_TIMEOUT_MS', 10_000),
  consumerPrefetch: numericEnv('MESSAGE_QUEUE_CONSUMER_PREFETCH', 20),
  maxAttempts: numericEnv('MESSAGE_QUEUE_MAX_ATTEMPTS', 10),
  retryBaseDelayMs: numericEnv('MESSAGE_QUEUE_RETRY_BASE_DELAY_MS', 1_000),
  retryMaxDelayMs: numericEnv('MESSAGE_QUEUE_RETRY_MAX_DELAY_MS', 600_000),
  connectionTimeoutMs: numericEnv('MESSAGE_QUEUE_CONNECTION_TIMEOUT_MS', 10_000),
  heartbeatSeconds: numericEnv('MESSAGE_QUEUE_HEARTBEAT_SECONDS', 30),
}));
