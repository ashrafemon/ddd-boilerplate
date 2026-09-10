import { registerAs } from '@nestjs/config';
import { booleanEnv, numericEnv, stringEnv } from './env.util';

export type IImportConfig = {
  maxFileSizeBytes: number;
  maxRows: number;
  validationChunkSize: number;
  executionChunkSize: number;
  progressEveryNRows: number;
  progressEveryMs: number;
  lockTtlMs: number;
  lockRenewalMs: number;
  maxConcurrentJobsPerTenant: number;
  workerConcurrency: number;
  jobAttempts: number;
  reconciliationWindowMs: number;
  presignedUploadTtlSeconds: number;
  previewRows: number;
  previewTimeoutMs: number;
  sourceRetentionDays: number;
  rowRetentionDays: number;
  /** When true, new uploads are marked CLEAN without an AV scanner. */
  skipAvScan: boolean;
  buildSha: string;
};

/**
 * Import pipeline config — limits, chunks, locks, retention.
 * Consumed only by platform/import.
 */
export default registerAs('import', (): IImportConfig => ({
  maxFileSizeBytes: numericEnv('IMPORT_MAX_FILE_SIZE_BYTES', 25 * 1024 * 1024),
  maxRows: numericEnv('IMPORT_MAX_ROWS', 50_000),
  validationChunkSize: numericEnv('IMPORT_VALIDATION_CHUNK_SIZE', 500),
  executionChunkSize: numericEnv('IMPORT_EXECUTION_CHUNK_SIZE', 200),
  progressEveryNRows: numericEnv('IMPORT_PROGRESS_EVERY_N_ROWS', 250),
  progressEveryMs: numericEnv('IMPORT_PROGRESS_EVERY_MS', 2_000),
  lockTtlMs: numericEnv('IMPORT_LOCK_TTL_MS', 60_000),
  lockRenewalMs: numericEnv('IMPORT_LOCK_RENEWAL_MS', 15_000),
  maxConcurrentJobsPerTenant: numericEnv('IMPORT_MAX_CONCURRENT_JOBS_PER_TENANT', 2),
  workerConcurrency: numericEnv('IMPORT_WORKER_CONCURRENCY', 5),
  jobAttempts: numericEnv('IMPORT_JOB_ATTEMPTS', 3),
  reconciliationWindowMs: numericEnv('IMPORT_RECONCILIATION_WINDOW_MS', 300_000),
  presignedUploadTtlSeconds: numericEnv('IMPORT_PRESIGNED_UPLOAD_TTL_SECONDS', 900),
  previewRows: numericEnv('IMPORT_PREVIEW_ROWS', 10),
  previewTimeoutMs: numericEnv('IMPORT_PREVIEW_TIMEOUT_MS', 5_000),
  sourceRetentionDays: numericEnv('IMPORT_SOURCE_RETENTION_DAYS', 7),
  rowRetentionDays: numericEnv('IMPORT_ROW_RETENTION_DAYS', 90),
  skipAvScan: booleanEnv('IMPORT_SKIP_AV_SCAN', true),
  buildSha: stringEnv('IMPORT_BUILD_SHA', stringEnv('GIT_SHA', 'dev')),
}));
