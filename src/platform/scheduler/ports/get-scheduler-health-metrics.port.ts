import { SchedulerHealthMetrics } from '../scheduler.types';

export abstract class GetSchedulerHealthMetricsPort {
  abstract execute(overdueThresholdMs?: number): Promise<SchedulerHealthMetrics>;
}
