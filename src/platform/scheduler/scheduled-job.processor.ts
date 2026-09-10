import { Injectable } from '@nestjs/common';
import { SchedulerQueuedJob } from './ports/scheduler-job-queue.port';
import { SchedulerEventPublisherPort } from './ports/scheduler-event-publisher.port';
import { ScheduledJobPayload } from './ports/scheduled-job-fire-handler.port';
import { ScheduledJobHandlerRegistry } from './scheduled-job-handler.registry';

/**
 * Executes a queued scheduled job. Registered handlers run in-process;
 * unregistered jobTypes fall back to RabbitMQ (same contract as before).
 */
@Injectable()
export class ScheduledJobProcessor {
  constructor(
    private readonly registry: ScheduledJobHandlerRegistry,
    private readonly publisher: SchedulerEventPublisherPort,
  ) {}

  async process(job: SchedulerQueuedJob): Promise<void> {
    const payload: ScheduledJobPayload = {
      jobId: job.jobId,
      tenantId: job.tenantId ?? undefined,
      jobType: job.jobType,
      scope: job.scope,
      aggregateType: job.aggregateType,
      aggregateId: job.aggregateId,
      payload: job.payload,
      idempotencyKey: job.idempotencyKey,
    };

    if (this.registry.has(job.jobType)) {
      await this.registry.resolveHandler(job.jobType).handle(payload);
      return;
    }

    await this.publisher.publishJobDue(job);
  }
}
