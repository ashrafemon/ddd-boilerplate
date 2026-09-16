/**
 * Cross-instance mutual exclusion (platform primitive, shared by every
 * platform service that polls or fans out — scheduler today, anything that
 * needs "exactly one worker in this tick" tomorrow).
 *
 * Backed by `platform/locking` (Redis SET NX + owner-token Lua release).
 * FAIL CLOSED: a caller that cannot take the lock must skip the work unit,
 * never run it speculatively.
 *
 * Every acquire returns an opaque owner ticket; renew/release only succeed
 * for the matching ticket, so a worker whose lease expired can never delete
 * the lock a healthier worker took over.
 */
export interface LockTicket {
  key: string;
  owner: string;
}

export abstract class DistributedLockPort {
  /** Returns a ticket when the lock was taken, or null (in use / backend down). */
  abstract acquire(key: string, ttlMs: number): Promise<LockTicket | null>;

  /** Extend the lease held by `ticket`; false when ownership was lost. */
  abstract renew(ticket: LockTicket, ttlMs: number): Promise<boolean>;

  /** Compare-and-delete: releases only if still held by `ticket`. Best effort. */
  abstract release(ticket: LockTicket): Promise<void>;

  /** Observability helper: whether any holder currently has the key locked. */
  abstract isHeld(key: string): Promise<boolean>;
}
