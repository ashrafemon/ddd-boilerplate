import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { ConfigService } from '@config/config.service';
import { ScheduledJobProcessor } from '../scheduled-job.processor';
import { SchedulerQueuedJob } from '../ports/scheduler-job-queue.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { ScheduledJobDispatchLogRepositoryPort } from '../ports/scheduled-job-dispatch-log-repository.port';
import { DispatchStatus } from '../scheduler.types';
import { SCHEDULER_QUEUE_NAME, SCHEDULER_WORKER_CONCURRENCY } from '../scheduler.constants';

@Processor(SCHEDULER_QUEUE_NAME, { concurrency: SCHEDULER_WORKER_CONCURRENCY })
export class BullMqSchedulerJobWorker extends WorkerHost {
  private readonly logger = new Logger(BullMqSchedulerJobWorker.name);

  constructor(
    private readonly processor: ScheduledJobProcessor,
    private readonly configService: ConfigService,
    private readonly jobs: ScheduledJobRepositoryPort,
    private readonly dispatchLogs: ScheduledJobDispatchLogRepositoryPort,
  ) {
    super();
  }

  async process(job: Job<SchedulerQueuedJob>): Promise<void> {
    await this.processor.process(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SchedulerQueuedJob> | undefined, err: Error): void {
    if (!job) {
      return;
    }
    const { jobAttempts } = this.configService.getScheduler();
    const maxAttempts = job.opts.attempts ?? jobAttempts;
    if (job.attemptsMade >= maxAttempts) {
      void this.recordFinalFailure(job.data, err);
    }
  }

  private async recordFinalFailure(job: SchedulerQueuedJob, err: Error): Promise<void> {
    const message = err.message;
    this.logger.error(`Scheduled job ${job.jobId} exhausted retries: ${message}`);
    try {
      await this.dispatchLogs.insert({
        id: randomUUID(),
        tenantId: job.tenantId,
        scheduledJobId: job.jobId,
        jobType: job.jobType,
        dispatchedAt: new Date(),
        completedAt: new Date(),
        outcome: DispatchStatus.FAILED,
        durationMs: null,
        errorMessage: message,
        idempotencyKey: randomUUID(),
      });
      await this.jobs.markFailed(job.jobId);
    } catch (updateErr) {
      this.logger.error(
        `Failed to record exhaustion for job ${job.jobId}: ${(updateErr as Error).message}`,
      );
    }
  }
}
