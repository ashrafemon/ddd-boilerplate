import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

export type IWebhookConfig = {
  deliveryAttempts: number;
  deliveryTimeoutMs: number;
  backoffBaseMs: number;
  circuitBreakerThreshold: number;
  reconciliationWindowMs: number;
  workerConcurrency: number;
};

export default registerAs('webhook', (): IWebhookConfig => ({
  deliveryAttempts: numericEnv('WEBHOOK_DELIVERY_ATTEMPTS', 6),
  deliveryTimeoutMs: numericEnv('WEBHOOK_DELIVERY_TIMEOUT_MS', 10_000),
  backoffBaseMs: numericEnv('WEBHOOK_BACKOFF_BASE_MS', 30_000),
  circuitBreakerThreshold: numericEnv('WEBHOOK_CIRCUIT_BREAKER_THRESHOLD', 10),
  reconciliationWindowMs: numericEnv('WEBHOOK_RECONCILIATION_WINDOW_MS', 600_000),
  workerConcurrency: numericEnv('WEBHOOK_WORKER_CONCURRENCY', 5),
}));
