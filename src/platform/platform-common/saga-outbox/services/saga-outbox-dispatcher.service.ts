import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { PublishSagaOutboxBatchUseCase } from '../use-cases/publish-saga-outbox-batch.usecase';
import { PurgePublishedSagaOutboxUseCase } from '../use-cases/purge-published-saga-outbox.usecase';

/**
 * Scheduled orchestration for `saga_outbox`: the dispatch tick plus the
 * retention sweep.
 *
 * Mirrors `OutboxDispatcherService` — same interval, same hardening (an
 * overlapping tick is skipped by the publisher's own guard, and `onModuleDestroy`
 * waits for the in-flight tick so a closing Prisma pool is never used). Separate
 * from the shared dispatcher on purpose: saga lifecycle events are published on
 * the saga's own schedule and cannot be blocked by business traffic (or the
 * other way round).
 */
@Injectable()
export class SagaOutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SagaOutboxDispatcherService.name);
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(
    private readonly publishPendingBatch: PublishSagaOutboxBatchUseCase,
    private readonly purgePublished: PurgePublishedSagaOutboxUseCase,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const { outboxPollIntervalMs } = this.configService.getSaga();
    this.timer = setInterval(() => void this.dispatch(), outboxPollIntervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.inFlight?.catch(() => undefined);
  }

  private async dispatch(): Promise<void> {
    this.inFlight = (async () => {
      try {
        const published = await this.publishPendingBatch.execute();
        if (published > 0) {
          this.logger.log(`Claimed and dispatched ${published} saga outbox messages`);
        }
      } catch (err) {
        this.logger.error(`Saga outbox dispatch tick failed: ${(err as Error).message}`);
      }
    })();
    await this.inFlight;
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanup-saga-outbox' })
  async cleanupPublished(): Promise<void> {
    const deleted = await this.purgePublished.execute();
    if (deleted > 0) {
      this.logger.log(`Deleted ${deleted} published saga outbox messages past retention`);
    }
  }
}
