import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { OutboxDispatcherAdapter } from './adapters/outbox-dispatcher.adapter';
import { OutboxReconciler } from './outbox-reconciliation';

/**
 * Scheduler jobs for the outbox sub-system. Business code never depends on
 * @nestjs/schedule directly; this scheduler coordinates dispatching,
 * lease reconciliation and cleanup.
 *
 * Retry timing is data-driven (per-row `availableAt` backoff + attempts
 * gate evaluated at claim time), so no periodic "reset FAILED" pass is needed.
 */
@Injectable()
export class OutboxScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxScheduler.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly dispatcher: OutboxDispatcherAdapter,
    private readonly reconciler: OutboxReconciler,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const { pollIntervalMs } = this.configService.getOutbox();
    this.timer = setInterval(() => void this.dispatchOutbox(), pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async dispatchOutbox(): Promise<void> {
    const published = await this.dispatcher.dispatchPendingBatch();
    if (published > 0) {
      this.logger.log(`Claimed and dispatched ${published} outbox messages`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'reconcile-outbox-leases' })
  reconcileOutbox(): void {
    void this.reconciler.reconcileExpiredClaims();
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanup-outbox' })
  cleanupOutbox(): void {
    // Cleanup is handled by the dispatcher's internal state — no extra action needed here.
    this.logger.debug('Outbox cleanup tick');
  }
}
