import { ensureEnvLoaded, numericEnv } from '@config/env.util';

export const SCHEDULER_QUEUE_NAME = 'scheduler.jobs';
export const SCHEDULER_JOB_NAME = 'execute';

// Read once at class-load for the @Processor decorator; parsed through the
// config layer's helpers so no module outside src/config touches process.env.
ensureEnvLoaded();
export const SCHEDULER_WORKER_CONCURRENCY = numericEnv('SCHEDULER_WORKER_CONCURRENCY', 5);
