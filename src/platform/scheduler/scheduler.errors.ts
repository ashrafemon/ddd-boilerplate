import { DomainException } from '@shared-kernel/exceptions/domain.exception';

export class DuplicateHandlerRegistrationError extends DomainException {
  constructor(jobType: string) {
    super(
      `ScheduledJobFireHandler for jobType '${jobType}' already registered`,
      'DUPLICATE_HANDLER_REGISTRATION',
      { jobType },
    );
    this.name = 'DuplicateHandlerRegistrationError';
  }
}

export class UnregisteredHandlerError extends DomainException {
  constructor(jobType: string) {
    super(
      `No ScheduledJobFireHandler registered for jobType '${jobType}'`,
      'UNREGISTERED_HANDLER',
      { jobType },
    );
    this.name = 'UnregisteredHandlerError';
  }
}

export class JobNotFoundError extends DomainException {
  constructor(jobId: string) {
    super(`Scheduled job '${jobId}' not found`, 'JOB_NOT_FOUND', { jobId });
    this.name = 'JobNotFoundError';
  }
}

export class InvalidCronExpressionError extends DomainException {
  constructor(cronExpression: string, cause?: string) {
    super(
      `Invalid cron expression '${cronExpression}'${cause ? `: ${cause}` : ''}`,
      'INVALID_CRON_EXPRESSION',
      { cronExpression, cause },
    );
    this.name = 'InvalidCronExpressionError';
  }
}

export class LockAcquisitionFailedError extends DomainException {
  constructor(jobId: string) {
    super(
      `Failed to acquire distributed lock for scheduled job '${jobId}'`,
      'LOCK_ACQUISITION_FAILED',
      { jobId },
    );
    this.name = 'LockAcquisitionFailedError';
  }
}

export class DuplicateJobTypeError extends DomainException {
  constructor(jobType: string) {
    super(`Duplicate jobType registration '${jobType}'`, 'DUPLICATE_JOB_TYPE', { jobType });
    this.name = 'DuplicateJobTypeError';
  }
}

export class InvalidScopeTenantError extends DomainException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INVALID_SCOPE_TENANT', details);
    this.name = 'InvalidScopeTenantError';
  }
}

export class OptimisticConcurrencyError extends DomainException {
  constructor(jobId: string, expectedVersion: number) {
    super(
      `Scheduled job '${jobId}' was modified concurrently (expected version ${expectedVersion})`,
      'OPTIMISTIC_CONCURRENCY',
      { jobId, expectedVersion },
    );
    this.name = 'OptimisticConcurrencyError';
  }
}
