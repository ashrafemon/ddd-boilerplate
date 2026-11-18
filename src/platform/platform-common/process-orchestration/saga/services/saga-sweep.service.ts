import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { SagaInboxRepositoryPort } from '../outbound/ports/saga-inbox.repository.port';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';
import { ExecuteSagaStepUseCase } from '../use-cases/execute-saga-step.usecase';
import { ExpireWaitStepUseCase } from '../use-cases/expire-wait-step.usecase';
import { STALE_LEASE_ERROR, SagaStepWorkerService } from './saga-step-worker.service';

const SWEEP_BATCH = 200;

/**
 * Scheduled sweep: run due steps, expire WAIT timeouts, re-queue stale leases.
 *
 * There is no reconciler: a crashed worker's lease simply expires and the next
 * tick re-queues the row, and a WAIT step whose timeout instant passed is settled
 * by `ExpireWaitStepUseCase`. Inbox retention runs hourly and is the only purge.
 */
@Injectable()
export class SagaSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SagaSweepService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly worker: SagaStepWorkerService,
    private readonly executeStep: ExecuteSagaStepUseCase,
    private readonly expireWait: ExpireWaitStepUseCase,
    private readonly steps: SagaStepRepositoryPort,
    private readonly inbox: SagaInboxRepositoryPort,
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
      const claimed = await this.worker.claimBatch();
      for (const step of claimed) {
        await this.executeStep.execute(step);
      }
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
      await this.expireWait.execute(step);
    }
  }

  private async releaseStaleLeases(): Promise<void> {
    const stale = await this.steps.findStaleRunning(new Date(), SWEEP_BATCH);
    for (const step of stale) {
      this.logger.warn(`Re-queueing saga step ${step.id} (${STALE_LEASE_ERROR})`);
      await this.steps.reschedule(step.id, step.attempts, new Date(), STALE_LEASE_ERROR);
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
