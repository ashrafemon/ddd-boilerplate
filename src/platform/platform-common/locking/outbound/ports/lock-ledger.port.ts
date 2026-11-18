import { DistributedLockIdentity, LockLedgerClaim } from '../../types/locking.types';

/**
 * Outbound port: the durable lock ledger (PostgreSQL).
 *
 * Redis decides *who holds the lock now*; this ledger decides *who is allowed
 * to act next* — it issues the monotonic `fencingToken` that a downstream
 * resource (stock, numbering, ledger) checks before accepting a write.
 *
 * Claims are upsert-increments guarded by `leaseUntil < now()`, so a crashed
 * owner never blocks a resource and a takeover always gets a higher token.
 */
export abstract class LockLedgerPort {
  /** Take the row if it is free or its lease lapsed; null when another owner is live. */
  abstract claim(
    identity: DistributedLockIdentity,
    lockKey: string,
    ownerToken: string,
    leaseUntil: Date,
  ): Promise<LockLedgerClaim | null>;

  /** Extend the lease of a live owner. Null when ownership is gone. */
  abstract renew(
    identity: DistributedLockIdentity,
    ownerToken: string,
    leaseUntil: Date,
  ): Promise<LockLedgerClaim | null>;

  /** Release the row. Idempotent; a stale ownerToken is a no-op. */
  abstract release(identity: DistributedLockIdentity, ownerToken: string): Promise<void>;
}
