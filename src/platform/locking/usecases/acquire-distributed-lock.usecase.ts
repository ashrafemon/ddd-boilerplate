import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@config/config.service';
import { RedisLockPort } from '../ports/redis-lock.port';
import { LockKeyBuilder } from '../lock-key.builder';
import { DistributedLockAcquireRequest, DistributedLockAcquireResult } from '../locking.types';

/**
 * Use case: acquire a distributed lock.
 *
 * Redis-only (design `common/03-lock`):
 * 1. Build the deterministic lock key from identity
 * 2. Attempt Redis SET NX PX — fast fail, no DB round-trip
 * 3. Allocate a monotonic fencing token from Redis (INCR)
 * 4. Return ACQUIRED with the ticket, or BUSY with retryAfterMs
 *
 * The client always decides what BUSY means (409 / retry / queue); the service
 * never waits or blocks.
 */
@Injectable()
export class AcquireDistributedLockUseCase {
  constructor(
    private readonly redisLock: RedisLockPort,
    private readonly keyBuilder: LockKeyBuilder,
    private readonly configService: ConfigService,
  ) {}

  async execute(request: DistributedLockAcquireRequest): Promise<DistributedLockAcquireResult> {
    const { defaultLeaseMs, minLeaseMs, maxLeaseMs } = this.configService.getLocking();
    const leaseMs = this.clamp(request.leaseMs ?? defaultLeaseMs, minLeaseMs, maxLeaseMs);

    const identity = {
      tenantId: request.tenantId,
      companyId: request.companyId,
      scope: request.scope,
      resource: request.resource,
    };

    const lockKey = this.keyBuilder.build(identity);
    const ownerToken = randomUUID();

    const acquired = await this.redisLock.acquire(lockKey, ownerToken, leaseMs);

    if (!acquired) {
      return { status: 'BUSY', retryAfterMs: leaseMs };
    }

    // We own the lease now; the fencing token orders us after earlier holders.
    const fencingToken = await this.redisLock.nextFencingToken(lockKey);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);

    return {
      status: 'ACQUIRED',
      ticket: {
        lockId: randomUUID(),
        lockKey,
        ownerToken,
        fencingToken,
        acquiredAt: now,
        expiresAt,
      },
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
