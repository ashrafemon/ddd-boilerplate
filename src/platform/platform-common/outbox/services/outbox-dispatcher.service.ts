import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { PublishPendingBatchUseCase } from '../use-cases/publish-pending-batch.usecase';
import { PurgePublishedOutboxUseCase } from '../use-cases/purge-published-outbox.usecase';

/**
 * Scheduled orchestration for the outbox: the dispatch tick plus the retention
 * sweep. It composes two use cases and owns no persistence itself.
 *
 * Retry timing is data-driven (per-row `nextRetryAt` backoff evaluated at claim
 * time), so there is no lease reconciler and no "reset FAILED" pass. A tick that
 * overlaps the previous one is skipped by the use case's own guard.
 */
@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(
    private readonly publishPendingBatch: PublishPendingBatchUseCase,
    private readonly purgePublished: PurgePublishedOutboxUseCase,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const { pollIntervalMs } = this.configService.getOutbox();
    this.timer = setInterval(() => void this.dispatch(), pollIntervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    // A tick that is still running would keep using the Prisma pool after the
    // container closed it ("Cannot use a pool after calling end on the pool").
    await this.inFlight?.catch(() => undefined);
  }

  private async dispatch(): Promise<void> {
    this.inFlight = (async () => {
      try {
        const published = await this.publishPendingBatch.execute();
        if (published > 0) {
          this.logger.log(`Claimed and dispatched ${published} outbox messages`);
        }
      } catch (err) {
        this.logger.error(`Outbox dispatch tick failed: ${(err as Error).message}`);
      }
    })();
    await this.inFlight;
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanup-outbox' })
  async cleanupPublished(): Promise<void> {
    const deleted = await this.purgePublished.execute();
    if (deleted > 0) {
      this.logger.log(`Deleted ${deleted} published outbox messages past retention`);
    }
  }
}
