import { Injectable } from '@nestjs/common';
import { GetSchedulerHealthMetricsPort } from '../ports/get-scheduler-health-metrics.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { ScheduledJobDispatchLogRepositoryPort } from '../ports/scheduled-job-dispatch-log-repository.port';
import { SchedulerHealthMetrics } from '../scheduler.types';

/** Module-level so ticker can stamp last success without DI cycles. */
let lastSuccessfulTickAt: Date | null = null;

export function markSchedulerTickSuccess(at: Date = new Date()): void {
  lastSuccessfulTickAt = at;
}

@Injectable()
export class GetSchedulerHealthMetricsUseCase implements GetSchedulerHealthMetricsPort {
  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,

    private readonly dispatchLogs: ScheduledJobDispatchLogRepositoryPort,
  ) {}

  async execute(overdueThresholdMs = 60_000): Promise<SchedulerHealthMetrics> {
    const since = new Date(Date.now() - 15 * 60_000);
    const [overdueCount, recentDispatchFailureCount] = await Promise.all([
      this.jobs.findOverdue(overdueThresholdMs),
      this.dispatchLogs.countFailuresSince(since),
    ]);
    return {
      overdueCount,
      recentDispatchFailureCount,
      lastSuccessfulTickAt,
    };
  }
}
