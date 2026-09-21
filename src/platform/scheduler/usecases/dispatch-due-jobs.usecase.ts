import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { ConfigService } from '@config/config.service';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { DistributedLockPort } from '@platform/locking/ports/distributed-lock.port';
import { SchedulerJobQueuePort } from '../ports/scheduler-job-queue.port';
import { ScheduledJobDispatchLogRepositoryPort } from '../ports/scheduled-job-dispatch-log-repository.port';
import { ClaimedJob, DispatchStatus, ScheduleMode } from '../scheduler.types';
import { CronCalculator } from '../cron-calculator';
import { SchedulerTickHeartbeat } from '../scheduler-tick.heartbeat';

const DEFAULT_TIME_BUDGET_MS = 25_000;

/**
 * Deterministic per-slot dispatch identity: the same (job, slot) fired twice
 * (crash before slot advance, manual re-fire, reconcile) maps to one key, so
 * BullMQ jobId dedupe and the dispatch-log upsert collapse duplicates.
 */
export function deriveIdempotencyKey(jobId: string, nextRunAt: Date): string {
  return createHash('sha256').update(`${jobId}:${nextRunAt.toISOString()}`).digest('hex');
}

@Injectable()
export class DispatchDueJobsUseCase {
  private readonly logger = new Logger(DispatchDueJobsUseCase.name);

  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,
    private readonly lock: DistributedLockPort,
    private readonly queue: SchedulerJobQueuePort,

    private readonly dispatchLogs: ScheduledJobDispatchLogRepositoryPort,
    private readonly configService: ConfigService,
    private readonly heartbeat: SchedulerTickHeartbeat,
  ) {}

  async execute(options?: { batchSize?: number; timeBudgetMs?: number }): Promise<number> {
    const { batchSize, lockTtlMs } = this.configService.getScheduler();
    const limit = options?.batchSize ?? batchSize;
    const budgetMs = options?.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
    const deadline = Date.now() + budgetMs;
    const lockedBy = randomUUID();
    let total = 0;
    let lockFailures = 0;

    while (Date.now() < deadline) {
      const claimed = await this.jobs.claimDue(limit, lockedBy);
      if (claimed.length === 0) {
        break;
      }
      for (const job of claimed) {
        if (!(await this.dispatchOne(job, lockTtlMs))) {
          lockFailures += 1;
        }
        total += 1;
      }
      if (claimed.length < limit) {
        break;
      }
    }

    if (lockFailures > 0) {
      this.logger.warn(`${lockFailures} of ${total} dispatches skipped (lock unavailable)`);
    }
    this.heartbeat.mark();
    return total;
  }

  /** Returns false when the per-job Redis lock could not be taken. */
  private async dispatchOne(job: ClaimedJob, lockTtlMs: number): Promise<boolean> {
    const result = await this.lock.acquire({
      tenantId: job.tenantId ?? 'system',
      organizationId: 'scheduler',
      scope: 'scheduled-job',
      resource: job.id,
      leaseMs: lockTtlMs,
    });

    if (result.status === 'BUSY') {
      // Fail closed: leave CLAIMED for reconciliation; do not enqueue.
      this.logger.warn(`Lock acquire failed for job ${job.id}; leaving CLAIMED for reconcile`);
      return false;
    }

    const ticket = result.ticket;
    const idempotencyKey = deriveIdempotencyKey(job.id, job.nextRunAt);
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
        scheduleMode: job.scheduleMode,
        cronExpression: job.cronExpression,
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
        const next = CronCalculator.nextRunAt(job.cronExpression, new Date());
        await this.jobs.markPendingWithNextRun(job.id, next, new Date());
      } else {
        // External: stay CLAIMED until the async handler calls reschedule-external-job.
        await this.jobs.touchLastRunAt(job.id);
      }
      return true;
    } catch (err) {
      const message = FailureMessage.of(err);
      this.logger.error(`Dispatch failed for job ${job.id}: ${message}`);
      try {
        const { maxRetries, retryBackoffBaseMs } = this.configService.getScheduler();
        await this.dispatchLogs.recordOutcome({
          idempotencyKey,
          scheduledJobId: job.id,
          jobType: job.jobType,
          tenantId: job.tenantId,
          dispatchedAt: new Date(started),
          completedAt: new Date(),
          outcome: DispatchStatus.FAILED,
          durationMs: Date.now() - started,
          errorMessage: message,
        });
        // A dispatch (enqueue) failure is transport, not the schedule: back
        // off to PENDING with retry escalation instead of terminal FAILED.
        await this.jobs.recordFailure(job.id, { maxRetries, backoffBaseMs: retryBackoffBaseMs });
      } catch (updateErr) {
        this.logger.error(
          `Failed to record failure for job ${job.id}: ${(updateErr as Error).message}`,
        );
      }
      return true;
    } finally {
      try {
        await this.lock.release({ ticket });
      } catch (releaseErr) {
        this.logger.error(
          `Failed to release lock for job ${job.id}: ${(releaseErr as Error).message}`,
        );
      }
    }
  }
}
