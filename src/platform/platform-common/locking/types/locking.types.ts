/**
 * Distributed Lock types — logical identity and lock state.
 */

/** Logical identity for a distributed lock. */
export interface DistributedLockIdentity {
  tenantId: string;
  companyId: string;
  scope: string;
  resource: string;
}

/**
 * Redis key for one lock identity: `lock:{tenant}:{company}:{scope}:{resource}`.
 *
 * Every part is percent-encoded, so an id containing the separator cannot
 * impersonate a second field (the collision class that bit the idempotency and
 * cache keys). The same resource in two companies locks independently.
 */
export function buildLockKey(identity: DistributedLockIdentity): string {
  return ['lock', identity.tenantId, identity.companyId, identity.scope, identity.resource]
    .map(encodeURIComponent)
    .join(':');
}

/** Request to acquire a distributed lock. */
export interface DistributedLockAcquireRequest {
  tenantId: string;
  companyId: string;
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
  /** The identity the lock was taken for — renew/release address the ledger with it. */
  identity: DistributedLockIdentity;
  ownerToken: string;
  fencingToken: number;
  acquiredAt: Date;
  expiresAt: Date;
}

/** Ledger row claimed for this holder (durable mode). */
export interface LockLedgerClaim {
  lockId: string;
  fencingToken: number;
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
