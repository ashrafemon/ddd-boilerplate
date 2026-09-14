import { Injectable, Logger } from '@nestjs/common';
import { SchedulerQueuedJob } from './ports/scheduler-job-queue.port';
import { SchedulerEventPublisherPort } from './ports/scheduler-event-publisher.port';
import { ScheduledJobPayload } from './ports/scheduled-job-fire-handler.port';
import { ScheduledJobRepositoryPort } from './ports/scheduled-job-repository.port';
import { JobStatus } from './scheduler.types';
import { ScheduledJobHandlerRegistry } from './scheduled-job-handler.registry';

/**
 * Executes a queued scheduled job. Registered handlers run in-process;
 * unregistered jobTypes fall back to RabbitMQ (same contract as before).
 */
@Injectable()
export class ScheduledJobProcessor {
  private readonly logger = new Logger(ScheduledJobProcessor.name);

  constructor(
    private readonly registry: ScheduledJobHandlerRegistry,
    private readonly publisher: SchedulerEventPublisherPort,
    private readonly jobs: ScheduledJobRepositoryPort,
  ) {}

  async process(job: SchedulerQueuedJob, attempt = 1): Promise<void> {
    // A cancel/suspend that races an already-enqueued execution is
    // authoritative: drop the queued run instead of firing a dead schedule.
    const row = await this.jobs.findById(job.jobId);
    if (row && (row.status === JobStatus.CANCELLED || row.status === JobStatus.SUSPENDED)) {
      this.logger.warn(
        `Skipping queued execution of scheduled job ${job.jobId}: status ${row.status}`,
      );
      return;
    }

    const payload: ScheduledJobPayload = {
      jobId: job.jobId,
      tenantId: job.tenantId ?? undefined,
      jobType: job.jobType,
      scope: job.scope,
      aggregateType: job.aggregateType,
      aggregateId: job.aggregateId,
      payload: job.payload,
      idempotencyKey: job.idempotencyKey,
      attempt,
    };

    if (this.registry.has(job.jobType)) {
      await this.registry.resolveHandler(job.jobType).handle(payload);
      return;
    }

    await this.publisher.publishJobDue(job);
  }
}
