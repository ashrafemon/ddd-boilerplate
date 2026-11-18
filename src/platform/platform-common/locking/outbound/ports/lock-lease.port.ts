/**
 * Outbound port: the live lock lease (Redis).
 *
 * `SET NX PX` is the exclusion primitive — the fastest possible "do I own this
 * right now" answer, with the TTL as the crash recovery. Renew and release are
 * atomic token comparisons (Lua), so an owner whose lease already expired can
 * never extend or delete the next owner's key.
 *
 * Fail-closed: an unavailable Redis returns false, never true.
 */
export abstract class LockLeasePort {
  /** `SET key value NX PX leaseMs`. False when someone else holds it. */
  abstract acquire(lockKey: string, ownerToken: string, leaseMs: number): Promise<boolean>;

  /** Token-checked `PEXPIRE`. False when this token no longer owns the key. */
  abstract renew(lockKey: string, ownerToken: string, leaseMs: number): Promise<boolean>;

  /** Token-checked `DEL`. False when this token no longer owns the key. */
  abstract release(lockKey: string, ownerToken: string): Promise<boolean>;

  /**
   * Fencing sequence for the non-durable mode (`LOCK_DURABLE=false`).
   *
   * Not durable: a Redis flush resets it. Production uses `LockLedgerPort`.
   */
  abstract nextFencingToken(lockKey: string): Promise<number>;

  /** Observability helper — is the key currently held? */
  abstract isHeld(lockKey: string): Promise<boolean>;
}
