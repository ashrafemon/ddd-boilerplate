import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { PrismaLockLedgerRepository } from '../repositories/prisma-lock-ledger.repository';
import { RedisLockLeaseAdapter } from '../adapters/redis-lock-lease.adapter';
import {
  clampLease,
  DistributedLockRenewRequest,
  DistributedLockRenewResult,
} from '../types/locking.types';

/**
 * Use case: extend a held lease (design `common/03-lock`).
 *
 * Renew before a third of the lease elapses on long jobs. LOST means somebody
 * else owns the lock now — the caller must stop immediately and must not write.
 *
 * The lease is renewed first: if Redis already lost it, the ledger is not
 * touched. If the lease renews but the ledger row has expired, the lease is
 * released and the result is LOST too, so the two halves never disagree.
 */
@Injectable()
export class RenewDistributedLockUseCase {
  constructor(
    private readonly lease: RedisLockLeaseAdapter,
    private readonly ledger: PrismaLockLedgerRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(request: DistributedLockRenewRequest): Promise<DistributedLockRenewResult> {
    const { ticket } = request;
    const { defaultLeaseMs, minLeaseMs, maxLeaseMs, durable } = this.configService.getLocking();
    const leaseMs = clampLease(request.leaseMs ?? defaultLeaseMs, minLeaseMs, maxLeaseMs);

    const renewed = await this.lease.renew(ticket.lockKey, ticket.ownerToken, leaseMs);
    if (!renewed) {
      return { status: 'LOST' };
    }

    const expiresAt = new Date(Date.now() + leaseMs);

    if (!durable) {
      return { status: 'RENEWED', ticket: { ...ticket, expiresAt } };
    }

    const claim = await this.ledger.renew(ticket.identity, ticket.ownerToken, expiresAt);
    if (!claim) {
      await this.lease.release(ticket.lockKey, ticket.ownerToken);
      return { status: 'LOST' };
    }

    return {
      status: 'RENEWED',
      ticket: { ...ticket, fencingToken: claim.fencingToken, expiresAt },
    };
  }
}
