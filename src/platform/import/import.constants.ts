import { ensureEnvLoaded, numericEnv } from '@config/env.util';

export const IMPORT_QUEUE_NAME = 'import.jobs';
export const IMPORT_PARSE_JOB_NAME = 'parse';
export const IMPORT_VALIDATE_JOB_NAME = 'validate';
export const IMPORT_EXECUTE_JOB_NAME = 'execute';

// Read once at class-load for the @Processor decorator.
ensureEnvLoaded();
export const IMPORT_WORKER_CONCURRENCY = numericEnv('IMPORT_WORKER_CONCURRENCY', 5);
