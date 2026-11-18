import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyRepositoryPort } from '../outbound/ports/idempotency.repository.port';

/**
 * Idempotency reconciliation service (design `common/02-idempotency`).
 *
 * Hourly: deletes expired IN_PROGRESS rows (their claim lease has lapsed even
 * if the row TTL has not) and expired COMPLETED rows (replay window over).
 * No parking lot — a crashed claim is reclaimed by the next reserve once its
 * lease expires, and this job bounds table growth.
 *
 * This is a **service**, not an adapter: it implements no port, it schedules and
 * calls the outbound port. `inbound/adapters/` is only for classes that
 * implement an inbound port.
 */
@Injectable()
export class IdempotencyReconciliationService {
  private readonly logger = new Logger(IdempotencyReconciliationService.name);

  constructor(private readonly repository: IdempotencyRepositoryPort) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'purge-expired-idempotency-keys' })
  async purgeExpired(): Promise<void> {
    const purged = await this.repository.purgeExpired(new Date());
    if (purged > 0) {
      this.logger.log(`Purged ${purged} expired idempotency rows`);
    }
  }
}
