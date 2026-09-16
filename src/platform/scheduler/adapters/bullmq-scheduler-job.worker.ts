import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { ScheduledJobProcessor } from '../scheduled-job.processor';
import { SchedulerQueuedJob } from '../ports/scheduler-job-queue.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { ScheduledJobDispatchLogRepositoryPort } from '../ports/scheduled-job-dispatch-log-repository.port';
import { DispatchStatus, ScheduleMode } from '../scheduler.types';
import { SCHEDULER_QUEUE_NAME, SCHEDULER_WORKER_CONCURRENCY } from '../scheduler.constants';

@Processor(SCHEDULER_QUEUE_NAME, { concurrency: SCHEDULER_WORKER_CONCURRENCY })
export class BullMqSchedulerJobWorker extends WorkerHost {
  private readonly logger = new Logger(BullMqSchedulerJobWorker.name);

  constructor(
    private readonly processor: ScheduledJobProcessor,
    private readonly configService: ConfigService,
    private readonly jobs: ScheduledJobRepositoryPort,
    private readonly dispatchLogs: ScheduledJobDispatchLogRepositoryPort,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  async process(job: Job<SchedulerQueuedJob>): Promise<void> {
    const data = job.data;

    // External rows still sit CLAIMED (the dispatch loop never advances them):
    // move to RUNNING with a refreshed lease so a long handler outruns the
    // stale-claim reconciler instead of being re-fired mid-flight.
    if (data.scheduleMode === ScheduleMode.EXTERNAL) {
      const { lockTtlMs } = this.configService.getScheduler();
      await this.jobs.markRunningExternal(data.jobId, new Date(Date.now() + lockTtlMs));
    }

    // Background executions have no HTTP request — restore tenancy/correlation
    // into CLS so audit, company config and nested outbox appends stay scoped.
    await this.requestContext.run(
      { tenantId: data.tenantId ?? undefined, correlationId: data.idempotencyKey },
      () => this.processor.process(data, job.attemptsMade + 1),
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SchedulerQueuedJob> | undefined, err: Error): void {
    if (!job) {
      return;
    }
    const { jobAttempts } = this.configService.getScheduler();
    const maxAttempts = job.opts.attempts ?? jobAttempts;
    if ((job.attemptsMade ?? 0) >= maxAttempts) {
      void this.recordFinalFailure(job, err);
    }
  }

  private async recordFinalFailure(job: Job<SchedulerQueuedJob>, err: Error): Promise<void> {
    const data = job.data;
    const message = err.message;
    this.logger.error(`Scheduled job ${data.jobId} exhausted BullMQ attempts: ${message}`);
    try {
      const { maxRetries, retryBackoffBaseMs } = this.configService.getScheduler();
      const outcome = await this.jobs.recordFailure(data.jobId, {
        maxRetries,
        backoffBaseMs: retryBackoffBaseMs,
      });
      await this.dispatchLogs.recordOutcome({
        idempotencyKey: data.idempotencyKey,
        scheduledJobId: data.jobId,
        jobType: data.jobType,
        tenantId: data.tenantId,
        dispatchedAt: job.timestamp ? new Date(job.timestamp) : new Date(),
        completedAt: new Date(),
        outcome: outcome === 'SUSPENDED' ? DispatchStatus.DEAD_LETTERED : DispatchStatus.FAILED,
        durationMs: null,
        errorMessage: message,
      });
      if (outcome === 'SUSPENDED') {
        this.logger.error(
          `Scheduled job ${data.jobId} (${data.jobType}) suspended after repeated failures: ${message}`,
        );
      }
    } catch (updateErr) {
      this.logger.error(
        `Failed to record exhaustion for job ${data.jobId}: ${(updateErr as Error).message}`,
      );
    }
  }
}
