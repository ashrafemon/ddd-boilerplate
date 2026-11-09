import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { PrismaOutboxRepository } from './repositories/prisma-outbox.repository';
import { PublishPendingBatchUseCase } from './usecases/publish-pending-batch.usecase';

/**
 * Outbox scheduler — drives the dispatch tick and the retention cleanup.
 *
 * Retry timing is data-driven (per-row `nextRetryAt` backoff evaluated at claim
 * time), so there is no lease reconciler and no "reset FAILED" pass.
 */
@Injectable()
export class OutboxScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxScheduler.name);
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(
    private readonly publishPendingBatch: PublishPendingBatchUseCase,
    private readonly repository: PrismaOutboxRepository,
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
    const { cleanupOlderThanHours } = this.configService.getOutbox();
    const deleted = await this.repository.deletePublishedOlderThan(cleanupOlderThanHours);
    if (deleted > 0) {
      this.logger.log(`Deleted ${deleted} published outbox messages past retention`);
    }
  }
}
