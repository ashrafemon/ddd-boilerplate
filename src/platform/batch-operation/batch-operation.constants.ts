import { ensureEnvLoaded, numericEnv } from '@config/env.util';

export const BATCH_OPERATION_QUEUE_NAME = 'batch-operation.chunks';
export const BATCH_OPERATION_CHUNK_JOB_NAME = 'process-chunk';

// Read once at class-load for the @Processor decorator; parsed through the
// config layer's helpers so no module outside src/config touches process.env.
ensureEnvLoaded();
export const BATCH_OPERATION_WORKER_CONCURRENCY = numericEnv(
  'BATCH_OPERATION_WORKER_CONCURRENCY',
  5,
);
