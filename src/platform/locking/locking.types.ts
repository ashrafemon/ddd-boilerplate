/**
 * Distributed Lock types — logical identity and lock state.
 */

/** Logical identity for a distributed lock. */
export interface DistributedLockIdentity {
  tenantId: string;
  organizationId: string;
  scope: string;
  resource: string;
}

/** Request to acquire a distributed lock. */
export interface DistributedLockAcquireRequest {
  tenantId: string;
  organizationId: string;
  scope: string;
  resource: string;
  leaseMs?: number;
}

/** Request to renew a held lock. */
export interface DistributedLockRenewRequest {
  ticket: DistributedLockTicket;
  leaseMs?: number;
}

/** Request to release a held lock. */
export interface DistributedLockReleaseRequest {
  ticket: DistributedLockTicket;
}

/**
 * Lock ticket — opaque proof of ownership.
 * Required for renew() and release().
 * Must not be reconstructed manually.
 */
export interface DistributedLockTicket {
  lockId: string;
  lockKey: string;
  ownerToken: string;
  fencingToken: number;
  acquiredAt: Date;
  expiresAt: Date;
}

/** Result of an acquire attempt. */
export type DistributedLockAcquireResult =
  | {
      status: 'ACQUIRED';
      ticket: DistributedLockTicket;
    }
  | {
      status: 'BUSY';
      retryAfterMs: number;
    };

/** Result of a renew attempt. */
export type DistributedLockRenewResult =
  | {
      status: 'RENEWED';
      ticket: DistributedLockTicket;
    }
  | {
      status: 'LOST';
    };

/** Persistent lock record in PostgreSQL. */
export interface DistributedLockRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  scope: string;
  resource: string;
  fencingToken: number;
  createdAt: Date;
  updatedAt: Date;
}
