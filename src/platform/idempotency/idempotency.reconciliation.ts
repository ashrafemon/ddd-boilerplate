import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaIdempotencyRepository } from './repositories/prisma-idempotency.repository';

/**
 * Idempotency reconciliation (design `common/02-idempotency`).
 *
 * Hourly: deletes expired IN_PROGRESS rows (their claim lease has lapsed even
 * if the row TTL has not) and expired COMPLETED rows (replay window over).
 * No parking lot — a crashed claim is reclaimed by the next reserve once its
 * lease expires, and this job bounds table growth.
 */
@Injectable()
export class IdempotencyReconciliation {
  private readonly logger = new Logger(IdempotencyReconciliation.name);

  constructor(private readonly repository: PrismaIdempotencyRepository) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'purge-expired-idempotency-keys' })
  async purgeExpired(): Promise<void> {
    const purged = await this.repository.purgeExpired(new Date());
    if (purged > 0) {
      this.logger.log(`Purged ${purged} expired idempotency rows`);
    }
  }
}
