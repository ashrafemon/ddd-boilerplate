import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { randomUUID } from 'crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '@infrastructure/cache/redis/redis.service';
import { DistributedLockPort, LockTicket } from '../ports/distributed-lock.port';

const KEY_PREFIX = 'platform:lock:';

/**
 * Redis SET NX PX lock with owner-token fencing.
 *
 * - value = random owner id; renew/release run compare-and-act Lua scripts so
 *   an expired holder can never extend or delete a lock another instance
 *   took over in the meantime.
 * - Fail closed: Redis missing or erroring yields null/false — pollers must
 *   skip their work unit, never run it speculatively.
 */
@Injectable()
export class RedisDistributedLockAdapter implements DistributedLockPort {
  private readonly logger = new Logger(RedisDistributedLockAdapter.name);

  constructor(@Optional() private readonly redisService?: RedisService) {}

  async acquire(key: string, ttlMs: number): Promise<LockTicket | null> {
    const client = this.clientOrNull();
    if (!client) {
      this.logger.error('Redis unavailable — lock acquire fail-closed');
      return null;
    }
    const owner = randomUUID();
    try {
      const result = await client.set(KEY_PREFIX + key, owner, 'PX', ttlMs, 'NX');
      return result === 'OK' ? { key, owner } : null;
    } catch (err) {
      this.logger.error(`Redis lock acquire error: ${FailureMessage.of(err)}`);
      return null;
    }
  }

  async renew(ticket: LockTicket, ttlMs: number): Promise<boolean> {
    const client = this.clientOrNull();
    if (!client) {
      return false;
    }
    try {
      const renewed = await client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
        1,
        KEY_PREFIX + ticket.key,
        ticket.owner,
        String(ttlMs),
      );
      return renewed === 1;
    } catch (err) {
      this.logger.error(`Redis lock renew error: ${FailureMessage.of(err)}`);
      return false;
    }
  }

  async release(ticket: LockTicket): Promise<void> {
    const client = this.clientOrNull();
    if (!client) {
      return;
    }
    try {
      await client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        KEY_PREFIX + ticket.key,
        ticket.owner,
      );
    } catch (err) {
      this.logger.error(`Redis lock release error: ${FailureMessage.of(err)}`);
    }
  }

  async isHeld(key: string): Promise<boolean> {
    const client = this.clientOrNull();
    if (!client) {
      return false;
    }
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
