import { DomainException } from '@shared-kernel/exceptions/domain.exception';

/**
 * Thrown when a domain module registers an entityKey a
 * second time — fail at boot, never silently overwrite.
 */
export class DuplicateImportHandlerRegistrationError extends DomainException {
  constructor(entityKey: string) {
    super(
      `ImportHandler for entityKey '${entityKey}' already registered`,
      'DUPLICATE_IMPORT_HANDLER_REGISTRATION',
      { entityKey },
    );
    this.name = 'DuplicateImportHandlerRegistrationError';
  }
}

/** Thrown when a request or job names an entityKey with no registered handler. */
export class UnregisteredImportHandlerError extends DomainException {
  constructor(entityKey: string) {
    super(
      `No ImportHandler registered for entityKey '${entityKey}'`,
      'UNREGISTERED_IMPORT_HANDLER',
      { entityKey },
    );
    this.name = 'UnregisteredImportHandlerError';
  }
}

/** Thrown when a job id does not resolve, or resolves outside the caller's tenant. */
export class ImportJobNotFoundError extends DomainException {
  constructor(jobId: string) {
    super(`ImportJob '${jobId}' not found`, 'IMPORT_JOB_NOT_FOUND', { jobId });
    this.name = 'ImportJobNotFoundError';
  }
}

/**
 * Thrown when a phase is entered from a status it cannot be entered from —
 * e.g. execute on a job that was never VALIDATED.
 */
export class InvalidImportJobStateError extends DomainException {
  constructor(jobId: string, from: string, expected: string | string[]) {
    const expectedList = Array.isArray(expected) ? expected : [expected];
    super(
      `ImportJob '${jobId}' is ${from}; expected one of: ${expectedList.join(', ')}`,
      'INVALID_IMPORT_JOB_STATE',
      { jobId, from, expected: expectedList },
    );
    this.name = 'InvalidImportJobStateError';
  }
}

/** Thrown when a cancel is requested for a job already in a terminal state. */
export class ImportJobNotCancellableError extends DomainException {
  constructor(jobId: string, status: string) {
    super(
      `ImportJob '${jobId}' is ${status} and can no longer be cancelled`,
      'IMPORT_JOB_NOT_CANCELLABLE',
      { jobId, status },
    );
    this.name = 'ImportJobNotCancellableError';
  }
}

/** Thrown before parsing when the uploaded file exceeds the descriptor's limit. */
export class ImportFileTooLargeError extends DomainException {
  constructor(entityKey: string, sizeBytes: number, maxFileSizeBytes: number) {
    super(
      `Import file of ${sizeBytes} bytes exceeds the ${maxFileSizeBytes} byte limit for entityKey '${entityKey}'`,
      'IMPORT_FILE_TOO_LARGE',
      { entityKey, sizeBytes, maxFileSizeBytes },
    );
    this.name = 'ImportFileTooLargeError';
  }
}

/** Thrown by the parser when the sheet has more data rows than the descriptor allows. */
export class ImportRowLimitExceededError extends DomainException {
  constructor(entityKey: string, rowCount: number, maxRows: number) {
    super(
      `Import of ${rowCount} rows exceeds the maximum of ${maxRows} for entityKey '${entityKey}'`,
      'IMPORT_ROW_LIMIT_EXCEEDED',
      { entityKey, rowCount, maxRows },
    );
    this.name = 'ImportRowLimitExceededError';
  }
}

/** Thrown when a job would read a source object the AV scanner has not cleared. */
export class ImportAvScanNotCleanError extends DomainException {
  constructor(storageObjectId: string, scanStatus: string) {
    super(
      `StorageObject '${storageObjectId}' has scanStatus ${scanStatus}; only CLEAN or SKIPPED objects may be imported`,
      'IMPORT_AV_SCAN_NOT_CLEAN',
      { storageObjectId, scanStatus },
    );
    this.name = 'ImportAvScanNotCleanError';
  }
}

/**
 * Thrown when a job parsed by an older build is resumed by a newer one — the
 * descriptor or parser may have changed, so the mapping can no longer be trusted.
 */
export class ImportBuildShaMismatchError extends DomainException {
  constructor(jobId: string, jobBuildSha: string | undefined, currentBuildSha: string) {
    super(
      `ImportJob '${jobId}' was parsed by build '${jobBuildSha ?? 'unknown'}' but is running on '${currentBuildSha}'`,
      'IMPORT_BUILD_SHA_MISMATCH',
      { jobId, jobBuildSha, currentBuildSha },
    );
    this.name = 'ImportBuildShaMismatchError';
  }
}

/** Thrown when validation starts without every required descriptor field mapped. */
export class ImportMappingIncompleteError extends DomainException {
  constructor(entityKey: string, missingFields: string[]) {
    super(
      `Column mapping for entityKey '${entityKey}' is missing required fields: ${missingFields.join(', ')}`,
      'IMPORT_MAPPING_INCOMPLETE',
      { entityKey, missingFields },
    );
    this.name = 'ImportMappingIncompleteError';
  }
}

/** Thrown when a mapping targets a field the descriptor does not declare. */
export class UnknownImportTargetFieldError extends DomainException {
  constructor(entityKey: string, unknownFields: string[]) {
    super(
      `Column mapping for entityKey '${entityKey}' targets unknown fields: ${unknownFields.join(', ')}`,
      'UNKNOWN_IMPORT_TARGET_FIELD',
      { entityKey, unknownFields },
    );
    this.name = 'UnknownImportTargetFieldError';
  }
}

/** Thrown at boot when a registered descriptor is internally inconsistent. */
export class InvalidImportDescriptorError extends DomainException {
  constructor(entityKey: string, reasons: string[]) {
    super(
      `ImportDescriptor for entityKey '${entityKey}' is invalid: ${reasons.join('; ')}`,
      'INVALID_IMPORT_DESCRIPTOR',
      { entityKey, reasons },
    );
    this.name = 'InvalidImportDescriptorError';
  }
}

/** Thrown when a job reaches parsing with no source object attached. */
export class ImportSourceFileMissingError extends DomainException {
  constructor(jobId: string) {
    super(
      `ImportJob '${jobId}' has no source storage object to parse`,
      'IMPORT_SOURCE_FILE_MISSING',
      { jobId },
    );
    this.name = 'ImportSourceFileMissingError';
  }
}

/** Thrown when a storage object id does not resolve. */
export class StorageObjectNotFoundError extends DomainException {
  constructor(storageObjectId: string) {
    super(`StorageObject '${storageObjectId}' not found`, 'STORAGE_OBJECT_NOT_FOUND', {
      storageObjectId,
    });
    this.name = 'StorageObjectNotFoundError';
  }
}
