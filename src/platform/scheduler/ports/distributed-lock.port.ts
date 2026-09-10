/** DI token (abstract class port). Implemented by RedisDistributedLockAdapter. */
export abstract class DistributedLockPort {
  abstract acquire(jobId: string, ttlMs: number): Promise<boolean>;
  abstract renew(jobId: string, ttlMs: number): Promise<boolean>;
  abstract release(jobId: string): Promise<void>;
}
