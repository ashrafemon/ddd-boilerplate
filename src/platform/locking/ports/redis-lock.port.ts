/**
 * Low-level Redis lock operations.
 * The adapter uses atomic Lua scripts for ownership validation.
 */
export abstract class RedisLockPort {
  /** Atomic SET key value NX PX leaseMs. Returns true if acquired. */
  abstract acquire(key: string, value: string, leaseMs: number): Promise<boolean>;

  /** Atomic ownership check + PEXPIRE. Returns true if renewed. */
  abstract renew(key: string, value: string, leaseMs: number): Promise<boolean>;

  /** Atomic ownership check + DEL. Returns true if released. */
  abstract release(key: string, value: string): Promise<boolean>;

  /** Check if a key exists (observability helper). */
  abstract isHeld(key: string): Promise<boolean>;
}
