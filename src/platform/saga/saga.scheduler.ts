import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { SagaInboxRepository, SagaStepRepository } from './repositories/prisma-saga.repository';
import { SagaEngine } from './application/saga-engine';
import { STALE_LEASE_ERROR, SagaStepWorker } from './workers/step-worker';

const SWEEP_BATCH = 200;

/**
 * SagaScheduler — drives the step worker and the two sweeps.
 *
 * There is no reconciler: a crashed worker's lease simply expires and the sweep
 * re-queues the row, and a WAIT step whose timeout instant passed is settled by
 * `engine.onWaitTimeout` (skip by default, compensate when configured).
 */
@Injectable()
export class SagaScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SagaScheduler.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly worker: SagaStepWorker,
    private readonly engine: SagaEngine,
    private readonly steps: SagaStepRepository,
    private readonly inbox: SagaInboxRepository,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const { sweepIntervalMs } = this.configService.getSaga();
    this.timer = setInterval(() => void this.tick(), sweepIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /** One tick: run due steps, expire WAIT timeouts, re-queue stale leases. */
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.worker.runBatch();
      await this.expireWaitSteps();
      await this.releaseStaleLeases();
    } catch (err) {
      this.logger.error(`Saga tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async expireWaitSteps(): Promise<void> {
    const due = await this.steps.findExpiredWaits(new Date(), SWEEP_BATCH);
    for (const step of due) {
      await this.engine.onWaitTimeout(step);
    }
  }

  private async releaseStaleLeases(): Promise<void> {
    const stale = await this.steps.findStaleRunning(new Date(), SWEEP_BATCH);
    for (const step of stale) {
      this.logger.warn(`Re-queueing saga step ${step.id} (${STALE_LEASE_ERROR})`);
      await this.steps.reschedule(step.id, step.attempt, new Date(), STALE_LEASE_ERROR);
    }
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanup-saga-inbox' })
  async cleanupInbox(): Promise<void> {
    const { inboxRetentionDays } = this.configService.getSaga();
    const deleted = await this.inbox.purgeOlderThan(inboxRetentionDays);
    if (deleted > 0) {
      this.logger.log(`Purged ${deleted} saga inbox rows past retention`);
    }
  }
}
