import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxPublisher } from './outbox-publisher';

/**
 * Scheduler jobs for the outbox sub-system. Business code never depends on
 * @nestjs/schedule directly; this outbox service coordinates publishing,
 * retries and cleanup.
 */
@Injectable()
export class OutboxScheduler {
  private readonly logger = new Logger(OutboxScheduler.name);

  constructor(private readonly outboxPublisher: OutboxPublisher) {}

  @Cron(CronExpression.EVERY_10_SECONDS, { name: 'publish-outbox' })
  async publishOutbox(): Promise<void> {
    const published = await this.outboxPublisher.publishPendingBatch();
    if (published > 0) {
      this.logger.log(`Published ${published} outbox messages`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'retry-outbox' })
  async retryOutbox(): Promise<void> {
    await this.outboxPublisher.retryFailed();
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanup-outbox' })
  async cleanupOutbox(): Promise<void> {
    await this.outboxPublisher.cleanup();
  }
}
