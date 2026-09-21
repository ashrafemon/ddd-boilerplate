import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { IdempotencyRepositoryPort } from './ports/idempotency-repository.port';

/**
 * Idempotency reconciler — two background jobs:
 *
 * 1. Suspend expired claims: IN_PROGRESS rows whose claimed_at is older
 *    than the claim lease are transitioned to SUSPENDED so they can be
 *    re-acquired by a retry.
 *
 * 2. Purge expired results: rows past their expires_at are deleted to
 *    bound table growth.
 */
@Injectable()
export class IdempotencyReconciler {
  private readonly logger = new Logger(IdempotencyReconciler.name);

  constructor(
    private readonly repository: IdempotencyRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'suspend-expired-idempotency-claims' })
  async suspendExpiredClaims(): Promise<void> {
    const { claimLeaseMs } = this.config.getIdempotency();
    const suspended = await this.repository.suspendExpiredClaims(claimLeaseMs);
    if (suspended > 0) {
      this.logger.log(`Suspended ${suspended} expired idempotency claims`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'purge-expired-idempotency-keys' })
  async purgeExpired(): Promise<void> {
    const purged = await this.repository.purgeExpired();
    if (purged > 0) {
      this.logger.log(`Purged ${purged} expired idempotency rows`);
    }
  }
}
