import { Injectable } from '@nestjs/common';

/**
 * Last successful scheduler tick, shared between DispatchDueJobsUseCase
 * (writes) and GetSchedulerHealthMetricsUseCase (reads) — replaces
 * module-level mutable state with an injectable singleton.
 */
@Injectable()
export class SchedulerTickHeartbeat {
  private lastSuccessfulTickAt: Date | null = null;

  mark(at: Date = new Date()): void {
    this.lastSuccessfulTickAt = at;
  }

  get lastTick(): Date | null {
    return this.lastSuccessfulTickAt;
  }
}
