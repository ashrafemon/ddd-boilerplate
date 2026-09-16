import { Injectable } from '@nestjs/common';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { ScheduledJobDispatchLogRepositoryPort } from '../ports/scheduled-job-dispatch-log-repository.port';
import { SchedulerTickHeartbeat } from '../scheduler-tick.heartbeat';
import { SchedulerHealthMetrics } from '../scheduler.types';

/** Module-level so ticker can stamp last success without DI cycles. */
@Injectable()
export class GetSchedulerHealthMetricsUseCase {
  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,

    private readonly dispatchLogs: ScheduledJobDispatchLogRepositoryPort,
    private readonly heartbeat: SchedulerTickHeartbeat,
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
      lastSuccessfulTickAt: this.heartbeat.lastTick,
    };
  }
}
