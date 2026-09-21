import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '@infrastructure/cache/redis/redis.service';
import { RedisLockPort } from '../ports/redis-lock.port';

const KEY_PREFIX = 'lock:';

/**
 * Redis-backed distributed lock adapter using atomic Lua scripts.
 *
 * - acquire: SET key value NX PX leaseMs
 * - renew:   ownership check + PEXPIRE (atomic via Lua)
 * - release: ownership check + DEL (atomic via Lua)
 *
 * Fail closed: Redis missing or erroring yields false — callers must skip work.
 */
@Injectable()
export class RedisDistributedLockAdapter implements RedisLockPort {
  private readonly logger = new Logger(RedisDistributedLockAdapter.name);

  constructor(@Optional() private readonly redisService?: RedisService) {}

  async acquire(key: string, value: string, leaseMs: number): Promise<boolean> {
    const client = this.clientOrNull();
    if (!client) {
      this.logger.error('Redis unavailable — lock acquire fail-closed');
      return false;
    }
    const result = await client.set(KEY_PREFIX + key, value, 'PX', leaseMs, 'NX');
    return result === 'OK';
  }

  async renew(key: string, value: string, leaseMs: number): Promise<boolean> {
    const client = this.clientOrNull();
    if (!client) return false;
    try {
      const renewed = await client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then " +
          "return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
        1,
        KEY_PREFIX + key,
        value,
        String(leaseMs),
      );
      return renewed === 1;
    } catch (err) {
      this.logger.error(
        `Redis lock renew error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  async release(key: string, value: string): Promise<boolean> {
    const client = this.clientOrNull();
    if (!client) return false;
    try {
      const released = await client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then " +
          "return redis.call('del', KEYS[1]) else return 0 end",
        1,
        KEY_PREFIX + key,
        value,
      );
      return released === 1;
    } catch (err) {
      this.logger.error(
        `Redis lock release error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  async isHeld(key: string): Promise<boolean> {
    const client = this.clientOrNull();
    if (!client) return false;
    try {
      return (await client.exists(KEY_PREFIX + key)) === 1;
    } catch {
      return false;
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
