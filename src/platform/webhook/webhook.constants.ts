import { ensureEnvLoaded, numericEnv } from '@config/env.util';

export const WEBHOOK_QUEUE_NAME = 'webhook.deliveries';
export const WEBHOOK_DELIVERY_JOB_NAME = 'deliver-webhook';

// Read once at class-load for the @Processor decorator; parsed through the
// config layer's helpers so no module outside src/config touches process.env.
ensureEnvLoaded();
export const WEBHOOK_WORKER_CONCURRENCY = numericEnv('WEBHOOK_WORKER_CONCURRENCY', 5);
