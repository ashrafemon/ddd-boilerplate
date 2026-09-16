import { Injectable, Logger } from '@nestjs/common';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { ScheduleMode } from '../scheduler.types';
import { CronCalculator } from '../cron-calculator';

/**
 * Stale CLAIMED/RUNNING rows (worker died) + missed-fire policy:
 * Cron → skip-to-next; External → catch-up (reset to PENDING with nextRunAt=now).
 */
@Injectable()
export class ReconcileMissedJobsUseCase {
  private readonly logger = new Logger(ReconcileMissedJobsUseCase.name);

  constructor(private readonly jobs: ScheduledJobRepositoryPort) {}

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
        const next = CronCalculator.nextRunAt(job.cronExpression, new Date());
        await this.jobs.markPendingWithNextRun(job.id, next);
        adjusted += 1;
      }
      // External: leave nextRunAt as-is so next tick catch-up-fires once.
    }

    return released + adjusted;
  }
}
