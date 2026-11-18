import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { LockLedgerPort } from '../outbound/ports/lock-ledger.port';
import { LockLeasePort } from '../outbound/ports/lock-lease.port';
import { DistributedLockReleaseRequest } from '../types/locking.types';

/**
 * Use case: release a lock (design `common/03-lock`).
 *
 * Always call it in a `finally`. Order matters: the lease goes first so the
 * resource is available again even if the ledger write fails, and both halves
 * are token-checked, so a stale holder cannot release the current owner's lock.
 *
 * Idempotent and best effort — releasing a lock you no longer hold is a no-op,
 * never an error.
 */
@Injectable()
export class ReleaseDistributedLockUseCase {
  constructor(
    private readonly lease: LockLeasePort,
    private readonly ledger: LockLedgerPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(request: DistributedLockReleaseRequest): Promise<void> {
    const { ticket } = request;

    await this.lease.release(ticket.lockKey, ticket.ownerToken).catch(() => false);

    if (!this.configService.getLocking().durable) return;

    await this.ledger.release(ticket.identity, ticket.ownerToken).catch(() => undefined);
  }
}
