import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@config/config.service';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { DispatchDueJobsService } from '../services/dispatch-due-jobs.service';
import { SchedulerTickHeartbeat } from '../scheduler-tick.heartbeat';

const DEFAULT_TIME_BUDGET_MS = 25_000;

@Injectable()
export class DispatchDueJobsUseCase {
  private readonly logger = new Logger(DispatchDueJobsUseCase.name);

  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,
    private readonly dispatch: DispatchDueJobsService,
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
        if (!(await this.dispatch.dispatchOne(job, lockTtlMs))) {
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
}
