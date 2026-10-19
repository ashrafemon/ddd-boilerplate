import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { RedisLockPort } from '../ports/redis-lock.port';
import { DistributedLockRenewRequest, DistributedLockRenewResult } from '../locking.types';

/**
 * Use case: renew a held distributed lock.
 *
 * Validates ownership atomically via Redis Lua script.
 * Returns RENEWED with updated ticket or LOST. LOST means another owner holds
 * the resource now — the caller must stop work immediately.
 */
@Injectable()
export class RenewDistributedLockUseCase {
  constructor(
    private readonly redisLock: RedisLockPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(request: DistributedLockRenewRequest): Promise<DistributedLockRenewResult> {
    const { defaultLeaseMs, minLeaseMs, maxLeaseMs } = this.configService.getLocking();
    const leaseMs = Math.min(Math.max(request.leaseMs ?? defaultLeaseMs, minLeaseMs), maxLeaseMs);

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
