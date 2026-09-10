import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@config/config.service';
import { DispatchDueJobsPort } from '../ports/dispatch-due-jobs.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { DistributedLockPort } from '../ports/distributed-lock.port';
import { SchedulerJobQueuePort } from '../ports/scheduler-job-queue.port';
import { ScheduledJobDispatchLogRepositoryPort } from '../ports/scheduled-job-dispatch-log-repository.port';
import { ClaimedJob, DispatchStatus, ScheduleMode } from '../scheduler.types';
import { computeNextRunAt } from '../cron-calculator';
import { markSchedulerTickSuccess } from './get-scheduler-health-metrics.usecase';

const DEFAULT_TIME_BUDGET_MS = 25_000;

@Injectable()
export class DispatchDueJobsUseCase implements DispatchDueJobsPort {
  private readonly logger = new Logger(DispatchDueJobsUseCase.name);

  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,
    private readonly lock: DistributedLockPort,
    private readonly queue: SchedulerJobQueuePort,

    private readonly dispatchLogs: ScheduledJobDispatchLogRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(options?: { batchSize?: number; timeBudgetMs?: number }): Promise<number> {
    const { batchSize, lockTtlMs } = this.configService.getScheduler();
    const limit = options?.batchSize ?? batchSize;
    const budgetMs = options?.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
    const deadline = Date.now() + budgetMs;
    const lockedBy = randomUUID();
    let total = 0;

    while (Date.now() < deadline) {
      const claimed = await this.jobs.claimDue(limit, lockedBy);
      if (claimed.length === 0) {
        break;
      }
      for (const job of claimed) {
        await this.dispatchOne(job, lockTtlMs);
        total += 1;
      }
      if (claimed.length < limit) {
        break;
      }
    }

    markSchedulerTickSuccess();
    return total;
  }

  private async dispatchOne(job: ClaimedJob, lockTtlMs: number): Promise<void> {
    const acquired = await this.lock.acquire(job.id, lockTtlMs);
    if (!acquired) {
      // Fail closed: leave CLAIMED for reconciliation; do not enqueue.
      this.logger.warn(`Lock acquire failed for job ${job.id}; leaving CLAIMED for reconcile`);
      return;
    }

    const idempotencyKey = randomUUID();
    const started = Date.now();

    try {
      await this.queue.enqueue({
        jobId: job.id,
        jobType: job.jobType,
        tenantId: job.tenantId,
        scope: job.scope,
        aggregateType: job.aggregateType,
        aggregateId: job.aggregateId,
        payload: job.payload,
        idempotencyKey,
        priority: 'normal',
      });

      await this.dispatchLogs.insert({
        id: idempotencyKey,
        tenantId: job.tenantId,
        scheduledJobId: job.id,
        jobType: job.jobType,
        dispatchedAt: new Date(started),
        completedAt: new Date(),
        outcome: DispatchStatus.SUCCESS,
        durationMs: Date.now() - started,
        idempotencyKey,
      });

      if (job.scheduleMode === ScheduleMode.CRON && job.cronExpression) {
        const next = computeNextRunAt(job.cronExpression, new Date());
        await this.jobs.markPendingWithNextRun(job.id, next, new Date());
      } else {
        // External: stay CLAIMED until the async handler calls reschedule-external-job.
        await this.jobs.touchLastRunAt(job.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Dispatch failed for job ${job.id}: ${message}`);
      try {
        await this.dispatchLogs.insert({
          id: randomUUID(),
          tenantId: job.tenantId,
          scheduledJobId: job.id,
          jobType: job.jobType,
          dispatchedAt: new Date(started),
          completedAt: new Date(),
          outcome: DispatchStatus.FAILED,
          durationMs: Date.now() - started,
          errorMessage: message,
          idempotencyKey,
        });
        await this.jobs.markFailed(job.id);
      } catch (updateErr) {
        this.logger.error(
          `Failed to record failure for job ${job.id}: ${(updateErr as Error).message}`,
        );
      }
    } finally {
      try {
        await this.lock.release(job.id);
      } catch (releaseErr) {
        this.logger.error(
          `Failed to release lock for job ${job.id}: ${(releaseErr as Error).message}`,
        );
      }
    }
  }
}
