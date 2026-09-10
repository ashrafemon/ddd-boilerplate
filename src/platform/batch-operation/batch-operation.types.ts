/**
 * Batch Operation Service vocabulary. `aggregateType` and `operationCode` are
 * opaque strings the pipeline never interprets beyond routing to a handler.
 */

export type BatchOperationMode = 'SYNC' | 'ASYNC';

export type BatchOperationJobStatus =
  'PENDING' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'CANCELLED';

export type BatchOperationRowStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

/** Why a row ended SKIPPED — an expected no-op, distinct from a real failure. */
export type BatchOperationSkipReason =
  'ALREADY_IN_TARGET_STATE' | 'VALIDATION_FAILED' | 'PERMISSION_DENIED';

export type BatchOperationRowOutcome = 'SUCCESS' | 'FAILED' | 'SKIPPED';

/**
 * Value object passed by the worker into every handler call. Never the HTTP
 * request — in Async mode there is no request scope at execution time, and
 * Sync is treated identically for consistency.
 */
export interface BatchOperationContext {
  tenantId?: string;
  batchOperationJobId: string;
  requestedBy?: string;
  traceId?: string;
}

export interface ValidationResult {
  canProceed: boolean;
  /** Free text or a BatchOperationSkipReason when the check fails. */
  reason?: string;
}

export interface ExecutionResult {
  /** What actually changed, captured for result_snapshot — never re-derived from the request. */
  resultSnapshot?: Record<string, unknown>;
}

export interface SubmitBatchOperationInput {
  aggregateType: string;
  operationCode: string;
  entityIds: string[];
  params?: Record<string, unknown>;
  tenantId?: string;
  companyId?: string;
  branchId?: string;
  requestedBy?: string;
  traceId?: string;
}

export interface ValidateBatchOperationInput {
  aggregateType: string;
  operationCode: string;
  entityIds: string[];
  params?: Record<string, unknown>;
  tenantId?: string;
}

export interface BatchOperationPreviewItem {
  entityId: string;
  canProceed: boolean;
  reason?: string;
}

export interface BatchOperationPreview {
  /** True only if every selected record would proceed. */
  canProceed: boolean;
  total: number;
  wouldProceed: number;
  wouldFail: number;
  items: BatchOperationPreviewItem[];
}

export interface BatchOperationRowRecord {
  id: string;
  entityId: string;
  status: BatchOperationRowStatus;
  skipReason: string | null;
  errorMessage: string | null;
  resultSnapshot: Record<string, unknown> | null;
  processingTimeMs: number | null;
  createdAt: Date;
  processedAt: Date | null;
}

export interface BatchOperationJobRecord {
  id: string;
  tenantId: string | null;
  companyId: string | null;
  branchId: string | null;
  jobNo: string;
  aggregateType: string;
  operationCode: string;
  operationParams: Record<string, unknown> | null;
  mode: BatchOperationMode;
  status: BatchOperationJobStatus;
  totalRecords: number;
  processedRecords: number;
  successRecords: number;
  failedRecords: number;
  skippedRecords: number;
  cancelRequested: boolean;
  requestedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  rows?: BatchOperationRowRecord[];
}

/** Header fields the repository needs to create a job in one transaction with its rows. */
export interface NewBatchOperationJob {
  jobNo: string;
  aggregateType: string;
  operationCode: string;
  operationParams: Record<string, unknown> | null;
  mode: BatchOperationMode;
  status: Extract<BatchOperationJobStatus, 'PENDING' | 'RUNNING'>;
  tenantId: string | null;
  companyId: string | null;
  branchId: string | null;
  requestedBy: string | null;
}

/** A claimed row handed to the worker's per-row loop. */
export interface ClaimedBatchOperationRow {
  id: string;
  entityId: string;
}

/** Everything the worker needs to process a chunk without re-reading the job. */
export interface BatchOperationDispatch {
  jobId: string;
  aggregateType: string;
  operationCode: string;
  params: Record<string, unknown> | undefined;
  tenantId: string | undefined;
  requestedBy: string | undefined;
  traceId: string | undefined;
  rowIds: string[];
}

export interface BatchOperationListQuery {
  tenantId?: string;
  status?: BatchOperationJobStatus;
  aggregateType?: string;
  page: number;
  pageSize: number;
}
