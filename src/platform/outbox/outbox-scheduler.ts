import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { OutboxPublisher } from './outbox-publisher';

/**
 * Scheduler jobs for the outbox sub-system. Business code never depends on
 * @nestjs/schedule directly; this outbox service coordinates publishing,
 * lease reconciliation and cleanup. Retry timing itself is data-driven
 * (per-row `nextRetryAt` backoff + attempts gate evaluated at claim time),
 * so no periodic "reset FAILED" pass is needed.
 */
@Injectable()
export class OutboxScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxScheduler.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly outboxPublisher: OutboxPublisher,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const { pollIntervalMs } = this.configService.getOutbox();
    this.timer = setInterval(() => void this.publishOutbox(), pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async publishOutbox(): Promise<void> {
    const published = await this.outboxPublisher.publishPendingBatch();
    if (published > 0) {
      this.logger.log(`Claimed and published ${published} outbox messages`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'reconcile-outbox-leases' })
  async reconcileOutbox(): Promise<void> {
    await this.outboxPublisher.reconcileStaleClaims();
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanup-outbox' })
  async cleanupOutbox(): Promise<void> {
    await this.outboxPublisher.cleanup();
  }
}
