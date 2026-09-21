import { Injectable } from '@nestjs/common';
import { RedisLockPort } from '../ports/redis-lock.port';
import { DistributedLockRenewRequest, DistributedLockRenewResult } from '../locking.types';

const DEFAULT_LEASE_MS = 30_000;

/**
 * Use case: renew a held distributed lock.
 *
 * Validates ownership atomically via Redis Lua script.
 * Returns RENEWED with updated ticket or LOST.
 */
@Injectable()
export class RenewDistributedLockUseCase {
  constructor(private readonly redisLock: RedisLockPort) {}

  async execute(request: DistributedLockRenewRequest): Promise<DistributedLockRenewResult> {
    const leaseMs = request.leaseMs ?? DEFAULT_LEASE_MS;

    const renewed = await this.redisLock.renew(
      request.ticket.lockKey,
      request.ticket.ownerToken,
      leaseMs,
    );

    if (!renewed) {
      return { status: 'LOST' };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);

    return {
      status: 'RENEWED',
      ticket: {
        ...request.ticket,
        expiresAt,
      },
    };
  }
}
