import { Injectable, Logger } from '@nestjs/common';
import { ReconcileMissedJobsPort } from '../ports/reconcile-missed-jobs.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { DistributedLockPort } from '../ports/distributed-lock.port';
import { ScheduleMode } from '../scheduler.types';
import { computeNextRunAt } from '../cron-calculator';

/**
 * Stale CLAIMED rows (Redis lock gone) + missed-fire policy:
 * Cron → skip-to-next; External → catch-up (reset to PENDING with nextRunAt=now).
 */
@Injectable()
export class ReconcileMissedJobsUseCase implements ReconcileMissedJobsPort {
  private readonly logger = new Logger(ReconcileMissedJobsUseCase.name);

  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,
    private readonly lock: DistributedLockPort,
  ) {}

  async execute(): Promise<number> {
    const released = await this.jobs.releaseStaleClaims();
    if (released > 0) {
      this.logger.warn(`Reconciled ${released} stale-claimed scheduled jobs`);
    }

    // Missed PENDING jobs whose nextRunAt is far past: apply mode policy.
    const overdue = await this.jobs.list({ status: 'PENDING', limit: 100 });
    let adjusted = 0;
    const threshold = Date.now() - 60_000;
    for (const job of overdue) {
      if (job.nextRunAt.getTime() > threshold) {
        continue;
      }
      // Only adjust if still pending and overdue — Cron skip-to-next avoids burst.
      if (job.scheduleMode === ScheduleMode.CRON && job.cronExpression) {
        const next = computeNextRunAt(job.cronExpression, new Date());
        await this.jobs.markPendingWithNextRun(job.id, next);
        adjusted += 1;
      }
      // External: leave nextRunAt as-is so next tick catch-up-fires once.
    }

    // Touch lock port so DI stays honest; unused in this path beyond documentation
    // that reconciliation pairs with Redis expiry.
    void this.lock;

    return released + adjusted;
  }
}
