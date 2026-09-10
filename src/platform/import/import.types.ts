/**
 * Import pipeline vocabulary. `entityKey` is opaque — resolved only via
 * ImportHandlerRegistry. Descriptors are data (snapshotted onto jobs), never behaviour.
 */

import { PresignedUpload } from '@platform/storage/ports/file-storage.port';
import { PageResult } from '@shared-kernel/types/pagination';

export type ImportJobStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOADED'
  | 'PARSING'
  | 'MAPPED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'
  | 'CANCELLED';

export type ImportRowValidationStatus = 'PENDING' | 'VALID' | 'INVALID' | 'DUPLICATE';
export type ImportRowExecutionStatus = 'PENDING' | 'PROCESSING' | 'APPLIED' | 'FAILED' | 'SKIPPED';

export type ColumnMapping = Record<string, string>;

export interface ImportFieldDescriptor {
  targetField: string;
  dataType: string;
  required: boolean;
  aliases: string[];
  i18nKey: string;
  maxLength?: number;
  enumValues?: string[];
}

/** Plain serialisable object — snapshotted onto the job as jsonb. No functions. */
export interface ImportDescriptor {
  entityKey: string;
  version: number;
  fields: ImportFieldDescriptor[];
  upsertKeys: string[][];
  maxRows: number;
  maxFileSizeBytes: number;
  executionChunkSize: number;
  templateStorageKey?: string;
}

export interface ImportOptions {
  mode?: 'insert' | 'upsert' | 'skip-invalid';
  [key: string]: unknown;
}

/**
 * Passed into every handler call. Never the HTTP request — workers have no
 * request scope; Sync and Async treat context identically.
 */
export interface ImportContext {
  tenantId?: string;
  userId?: string;
  jobId: string;
  traceId?: string;
  /** Opaque permission bag until ABAC PermissionSet lands in shared-kernel. */
  permissions?: Record<string, unknown>;
  options: ImportOptions;
}

/** Opaque bag returned by preloadReferences; pipeline never inspects it. */
export type PreloadedReferences = Record<string, unknown>;

export interface RowVerdict {
  rowNumber: number;
  status: ImportRowValidationStatus;
  errors?: string[];
}

export interface RowResult {
  rowNumber: number;
  status: ImportRowExecutionStatus;
  entityId?: string;
  secondaryEntityIds?: string[];
  errorMessage?: string;
}

export interface StatusHistoryEntry {
  from: string;
  to: string;
  at: Date;
  actor?: string;
  detail?: string;
}

export interface ImportJobRecord {
  id: string;
  tenantId?: string;
  jobNo: string;
  entityKey: string;
  status: ImportJobStatus;
  descriptorVersion: number;
  descriptorSnapshot: ImportDescriptor;
  columnMapping?: ColumnMapping;
  statusHistory: StatusHistoryEntry[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  appliedRows: number;
  failedRows: number;
  cancelRequested: boolean;
  sourceStorageObjectId?: string;
  errorReportStorageObjectId?: string;
  options?: ImportOptions;
  requestedBy?: string;
  traceId?: string;
  buildSha?: string;
  heartbeatAt?: Date;
  lockedUntil?: Date;
  lockedBy?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/** Statuses a job can never leave. */
export type TerminalImportJobStatus = Extract<
  ImportJobStatus,
  'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'CANCELLED'
>;

export interface ImportJobRowRecord {
  id: string;
  tenantId?: string;
  importJobId: string;
  rowNumber: number;
  rawPayload?: Record<string, unknown>;
  mappedPayload?: Record<string, unknown>;
  validationStatus: ImportRowValidationStatus;
  executionStatus: ImportRowExecutionStatus;
  validationErrors?: string[];
  errorMessage?: string;
  entityId?: string;
  secondaryEntityIds?: string[];
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

export type StorageObjectPurpose =
  'IMPORT_SOURCE' | 'IMPORT_ERROR_REPORT' | 'EXPORT_RESULT' | 'OTHER';

export type StorageScanStatus = 'PENDING' | 'CLEAN' | 'INFECTED' | 'SKIPPED';

export interface StorageObjectRecord {
  id: string;
  tenantId?: string;
  storageKey: string;
  purpose: StorageObjectPurpose;
  contentType?: string;
  sizeBytes?: number;
  checksum?: string;
  scanStatus: StorageScanStatus;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportJobListQuery {
  tenantId?: string;
  status?: ImportJobStatus;
  entityKey?: string;
  page: number;
  pageSize: number;
}

export interface NewImportJob {
  tenantId?: string;
  jobNo: string;
  entityKey: string;
  descriptorVersion: number;
  descriptorSnapshot: ImportDescriptor;
  sourceStorageObjectId: string;
  columnMapping?: ColumnMapping;
  options?: ImportOptions;
  requestedBy?: string;
  traceId?: string;
  buildSha?: string;
}

/** A row as first written by the parser — mapped payload only once a mapping exists. */
export interface NewImportJobRow {
  rowNumber: number;
  rawPayload?: Record<string, unknown>;
  mappedPayload?: Record<string, unknown>;
  tenantId?: string;
}

/** A row claimed for execution, carrying only what the handler needs. */
export interface ClaimedImportRow {
  id: string;
  rowNumber: number;
  mappedPayload: Record<string, unknown>;
}

/** Signed counter deltas applied atomically to the job header. */
export interface ImportProgressDelta {
  totalRows?: number;
  validRows?: number;
  invalidRows?: number;
  appliedRows?: number;
  failedRows?: number;
}

export interface ImportRowStatusCounts {
  total: number;
  pendingValidation: number;
  valid: number;
  invalid: number;
  duplicate: number;
  pendingExecution: number;
  applied: number;
  failed: number;
  skipped: number;
}

export interface NewStorageObject {
  storageKey: string;
  purpose: StorageObjectPurpose;
  tenantId?: string;
  contentType?: string;
  sizeBytes?: number;
  expiresAt?: Date;
}

export interface ImportJobRowFilter {
  validationStatus?: ImportRowValidationStatus;
  executionStatus?: ImportRowExecutionStatus;
  page: number;
  pageSize: number;
}

export interface InitImportInput {
  entityKey: string;
  tenantId?: string;
}

/** What the UI needs to render the mapping screen before anything is uploaded. */
export interface InitImportResult {
  entityKey: string;
  descriptorVersion: number;
  fields: ImportFieldDescriptor[];
  maxRows: number;
  maxFileSizeBytes: number;
  templateStorageKey?: string;
}

export interface CreateImportUploadInput {
  entityKey: string;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
  tenantId?: string;
  requestedBy?: string;
  idempotencyKey?: string;
}

export interface CreateImportUploadResult {
  storageObjectId: string;
  /** Browser-direct upload slot from FileStoragePort — the API never proxies the bytes. */
  upload: PresignedUpload;
}

export interface CreateImportJobInput {
  entityKey: string;
  storageObjectId: string;
  columnMapping?: ColumnMapping;
  options?: ImportOptions;
  tenantId?: string;
  requestedBy?: string;
  traceId?: string;
}

export interface UpdateImportMappingInput {
  jobId: string;
  columnMapping: ColumnMapping;
  tenantId?: string;
  actor?: string;
}

/** Detected columns plus a sample, so the user can confirm the mapping. */
export interface ImportPreview {
  job: ImportJobRecord;
  sourceColumns: string[];
  suggestedMapping: ColumnMapping;
  unmappedRequiredFields: string[];
  sampleRows: ImportJobRowRecord[];
}

export interface ImportReportQuery {
  jobId: string;
  tenantId?: string;
  filter: ImportJobRowFilter;
}

export interface ImportReport {
  job: ImportJobRecord;
  counts: ImportRowStatusCounts;
  rows: PageResult<ImportJobRowRecord>;
  errorReportStorageObjectId?: string;
}

export interface ExecuteImportJobInput {
  jobId: string;
  tenantId?: string;
  options?: ImportOptions;
  requestedBy?: string;
}

export interface ExecuteImportChunkInput {
  jobId: string;
  /** Upper bound on rows claimed in this pass; defaults to the descriptor's chunk size. */
  chunkSize?: number;
  workerId: string;
}

/**
 * Why a worker pass ended. `SKIPPED_LOCK` means another delivery holds the job —
 * expected under at-least-once delivery, never an error.
 */
export type ImportWorkerOutcome = 'PROCESSED' | 'SKIPPED_LOCK' | 'CANCELLED';

export interface ImportChunkOutcome {
  outcome: ImportWorkerOutcome;
  claimedRows: number;
  appliedRows: number;
  failedRows: number;
  /** False once no claimable rows remain — the worker stops re-enqueueing. */
  hasMore: boolean;
}
