/**
 * Low-level Redis lock operations.
 * The adapter uses atomic Lua scripts for ownership validation.
 *
 * This service is Redis-only: ownership, lease TTL and the monotonic fencing
 * token sequence all live in Redis (see design `common/03-lock`).
 */
export abstract class RedisLockPort {
  /** Atomic SET key value NX PX leaseMs. Returns true if acquired. */
  abstract acquire(key: string, value: string, leaseMs: number): Promise<boolean>;

  /** Atomic ownership check + PEXPIRE. Returns true if renewed. */
  abstract renew(key: string, value: string, leaseMs: number): Promise<boolean>;

  /** Atomic ownership check + DEL. Returns true if released. */
  abstract release(key: string, value: string): Promise<boolean>;

  /**
   * Atomically increment the durable fencing-token counter for a lock key and
   * return the new value. Monotonic per key; lets downstream resources reject
   * stale owners after a lease expires.
   */
  abstract nextFencingToken(key: string): Promise<number>;

  /** Check if a key exists (observability helper). */
  abstract isHeld(key: string): Promise<boolean>;
}
