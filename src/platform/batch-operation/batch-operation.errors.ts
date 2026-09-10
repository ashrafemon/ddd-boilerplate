import { DomainException } from '@shared-kernel/exceptions/domain.exception';

/**
 * Thrown when an aggregate module registers an
 * aggregateType a second time — fail at boot, never silently overwrite.
 */
export class DuplicateBatchHandlerRegistrationError extends DomainException {
  constructor(aggregateType: string) {
    super(
      `BatchOperationHandler for aggregateType '${aggregateType}' already registered`,
      'DUPLICATE_BATCH_HANDLER_REGISTRATION',
      { aggregateType },
    );
    this.name = 'DuplicateBatchHandlerRegistrationError';
  }
}

/** Thrown when a submission names an aggregateType with no registered handler. */
export class UnregisteredBatchHandlerError extends DomainException {
  constructor(aggregateType: string) {
    super(
      `No BatchOperationHandler registered for aggregateType '${aggregateType}'`,
      'UNREGISTERED_BATCH_HANDLER',
      { aggregateType },
    );
    this.name = 'UnregisteredBatchHandlerError';
  }
}

/**
 * Thrown at boot when the supportedOperations array passed to forHandler()
 * disagrees with what the resolved adapter actually reports.
 */
export class BatchHandlerOperationMismatchError extends DomainException {
  constructor(aggregateType: string, missing: string[]) {
    super(
      `BatchOperationHandler '${aggregateType}' was registered for operations it does not report: ${missing.join(', ')}`,
      'BATCH_HANDLER_OPERATION_MISMATCH',
      { aggregateType, missing },
    );
    this.name = 'BatchHandlerOperationMismatchError';
  }
}

/** Thrown when a submission's operationCode is not in the resolved handler's supportedOperations. */
export class UnsupportedBatchOperationError extends DomainException {
  constructor(aggregateType: string, operationCode: string) {
    super(
      `aggregateType '${aggregateType}' does not support operationCode '${operationCode}'`,
      'UNSUPPORTED_BATCH_OPERATION',
      { aggregateType, operationCode },
    );
    this.name = 'UnsupportedBatchOperationError';
  }
}

/** Thrown when the selection is empty (after de-duplication). */
export class EmptyBatchSelectionError extends DomainException {
  constructor() {
    super('A batch operation must target at least one record', 'EMPTY_BATCH_SELECTION');
    this.name = 'EmptyBatchSelectionError';
  }
}

/** Thrown when the selection exceeds the configured per-job limit. */
export class BatchSelectionTooLargeError extends DomainException {
  constructor(size: number, limit: number) {
    super(
      `Selection of ${size} records exceeds the maximum of ${limit} per batch operation`,
      'BATCH_SELECTION_TOO_LARGE',
      { size, limit },
    );
    this.name = 'BatchSelectionTooLargeError';
  }
}

/** Thrown when a cancel is requested for a job already in a terminal state. */
export class BatchOperationNotCancellableError extends DomainException {
  constructor(jobId: string, status: string) {
    super(
      `BatchOperationJob '${jobId}' is ${status} and can no longer be cancelled`,
      'BATCH_OPERATION_NOT_CANCELLABLE',
      { jobId, status },
    );
    this.name = 'BatchOperationNotCancellableError';
  }
}

/** Thrown when a job id does not resolve. */
export class BatchOperationJobNotFoundError extends DomainException {
  constructor(jobId: string) {
    super(`BatchOperationJob '${jobId}' not found`, 'BATCH_OPERATION_JOB_NOT_FOUND', { jobId });
    this.name = 'BatchOperationJobNotFoundError';
  }
}
