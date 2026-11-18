import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@config/config.service';
import { LockLedgerPort } from '../outbound/ports/lock-ledger.port';
import { LockLeasePort } from '../outbound/ports/lock-lease.port';
import {
  buildLockKey,
  DistributedLockAcquireRequest,
  DistributedLockAcquireResult,
  DistributedLockIdentity,
} from '../types/locking.types';

/**
 * Use case: acquire a distributed lock (design `common/03-lock`).
 *
 * Two halves, in this order:
 *
 * 1. **Lease (Redis, `SET NX PX`)** — the fast, authoritative "is it held now".
 *    A refusal is BUSY; an unavailable Redis is BUSY too (fail-closed).
 * 2. **Ledger (PostgreSQL)** — the durable identity and the monotonic fencing
 *    token, taken only after the lease is won. If the ledger refuses (another
 *    owner is still live there), the lease is handed back so the two halves
 *    cannot drift apart.
 *
 * `LOCK_DURABLE=false` skips step 2 and takes the token from a Redis counter —
 * a dev escape hatch: a Redis flush resets that sequence.
 *
 * The caller always decides what BUSY means (404/409/retry/queue); nothing here
 * waits or blocks.
 */
@Injectable()
export class AcquireDistributedLockUseCase {
  private readonly logger = new Logger(AcquireDistributedLockUseCase.name);

  constructor(
    private readonly lease: LockLeasePort,
    private readonly ledger: LockLedgerPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(request: DistributedLockAcquireRequest): Promise<DistributedLockAcquireResult> {
    const { defaultLeaseMs, minLeaseMs, maxLeaseMs, durable } = this.configService.getLocking();
    const leaseMs = this.clamp(request.leaseMs ?? defaultLeaseMs, minLeaseMs, maxLeaseMs);

    const identity: DistributedLockIdentity = {
      tenantId: request.tenantId,
      companyId: request.companyId,
      scope: request.scope,
      resource: request.resource,
    };
    const lockKey = buildLockKey(identity);
    const ownerToken = randomUUID();

    const leased = await this.lease.acquire(lockKey, ownerToken, leaseMs);
    if (!leased) {
      return { status: 'BUSY', retryAfterMs: leaseMs };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);

    if (!durable) {
      const fencingToken = await this.lease.nextFencingToken(lockKey).catch(() => null);
      if (fencingToken === null) {
        await this.lease.release(lockKey, ownerToken);
        return { status: 'BUSY', retryAfterMs: leaseMs };
      }
      return {
        status: 'ACQUIRED',
        ticket: {
          lockId: randomUUID(),
          lockKey,
          identity,
          ownerToken,
          fencingToken,
          acquiredAt: now,
          expiresAt,
        },
      };
    }

    const claim = await this.ledger.claim(identity, lockKey, ownerToken, expiresAt);
    if (!claim) {
      // Redis said yes but Postgres still has a live owner: give the lease back.
      this.logger.warn(`ledger-refused-lease lock=${lockKey}`);
      await this.lease.release(lockKey, ownerToken);
      return { status: 'BUSY', retryAfterMs: leaseMs };
    }

    return {
      status: 'ACQUIRED',
      ticket: {
        lockId: claim.lockId,
        lockKey,
        identity,
        ownerToken,
        fencingToken: claim.fencingToken,
        acquiredAt: now,
        expiresAt,
      },
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
