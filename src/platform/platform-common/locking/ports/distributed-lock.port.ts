import {
  DistributedLockAcquireRequest,
  DistributedLockAcquireResult,
  DistributedLockRenewRequest,
  DistributedLockRenewResult,
  DistributedLockReleaseRequest,
} from '../locking.types';

/**
 * Cross-instance mutual exclusion — the platform distributed lock primitive.
 *
 * Business modules inject this port and control the sequence:
 * 1. acquire()
 * 2. execute operation
 * 3. release()
 *
 * For long-running operations:
 * 1. acquire()
 * 2. execute operation
 * 3. renew()
 * 4. execute operation
 * 5. release()
 *
 * FAIL CLOSED: a caller that cannot take the lock must skip the work unit,
 * never run it speculatively.
 */
export abstract class DistributedLockPort {
  /** Try to acquire exclusive ownership. Returns ACQUIRED with ticket or BUSY. */
  abstract acquire(request: DistributedLockAcquireRequest): Promise<DistributedLockAcquireResult>;

  /** Extend the lease held by ticket. Returns RENEWED or LOST. */
  abstract renew(request: DistributedLockRenewRequest): Promise<DistributedLockRenewResult>;

  /** Release ownership. Idempotent — best effort. */
  abstract release(request: DistributedLockReleaseRequest): Promise<void>;
}
