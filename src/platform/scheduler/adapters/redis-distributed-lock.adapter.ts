import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '@infrastructure/cache/redis/redis.service';
import { DistributedLockPort } from '../ports/distributed-lock.port';

const KEY_PREFIX = 'scheduler:lock:';

/**
 * Redis SET NX PX lock. Fail closed: if Redis is unavailable, acquire returns false.
 */
@Injectable()
export class RedisDistributedLockAdapter implements DistributedLockPort {
  private readonly logger = new Logger(RedisDistributedLockAdapter.name);

  constructor(@Optional() private readonly redisService?: RedisService) {}

  async acquire(jobId: string, ttlMs: number): Promise<boolean> {
    const client = this.clientOrNull();
    if (!client) {
      this.logger.error('Redis unavailable — lock acquire fail-closed');
      return false;
    }
    try {
      const result = await client.set(KEY_PREFIX + jobId, '1', 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (err) {
      this.logger.error(`Redis lock acquire error: ${(err as Error).message}`);
      return false;
    }
  }

  async renew(jobId: string, ttlMs: number): Promise<boolean> {
    const client = this.clientOrNull();
    if (!client) {
      return false;
    }
    try {
      const key = KEY_PREFIX + jobId;
      const exists = await client.exists(key);
      if (!exists) {
        return false;
      }
      await client.pexpire(key, ttlMs);
      return true;
    } catch (err) {
      this.logger.error(`Redis lock renew error: ${(err as Error).message}`);
      return false;
    }
  }

  async release(jobId: string): Promise<void> {
    const client = this.clientOrNull();
    if (!client) {
      return;
    }
    try {
      await client.del(KEY_PREFIX + jobId);
    } catch (err) {
      this.logger.error(`Redis lock release error: ${(err as Error).message}`);
    }
  }

  private clientOrNull() {
    try {
      return this.redisService?.client ?? null;
    } catch {
      return null;
    }
  }
}
