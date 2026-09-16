import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyPort } from './ports/idempotency.port';

/**
 * Drops expired ledger rows (replay results, abandoned IN_PROGRESS claims,
 * aged FAILED markers). Expired IN_PROGRESS rows never block a takeover —
 * reserve() re-arms them atomically — this cron only bounds table growth.
 */
@Injectable()
export class IdempotencyReconciler {
  private readonly logger = new Logger(IdempotencyReconciler.name);

  constructor(private readonly idempotency: IdempotencyPort) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'purge-expired-idempotency-keys' })
  async run(): Promise<void> {
    const purged = await this.idempotency.purgeExpired();
    if (purged > 0) {
      this.logger.log(`Purged ${purged} expired idempotency rows`);
    }
  }
}
