import { ensureEnvLoaded, numericEnv } from '@config/env.util';

export const NOTIFICATION_QUEUE_NAME = 'notification.chunks';
export const NOTIFICATION_CHUNK_JOB_NAME = 'process-chunk';

// Read once at class-load for the @Processor decorator; parsed through the
// config layer's helpers so no module outside src/config touches process.env.
ensureEnvLoaded();
export const NOTIFICATION_WORKER_CONCURRENCY = numericEnv('NOTIFICATION_WORKER_CONCURRENCY', 5);
