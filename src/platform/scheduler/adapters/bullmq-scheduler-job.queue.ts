import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@config/config.service';
import { SchedulerJobQueuePort, SchedulerQueuedJob } from '../ports/scheduler-job-queue.port';
import { SCHEDULER_JOB_NAME, SCHEDULER_QUEUE_NAME } from '../scheduler.constants';
import { isDuplicateJobError } from '@infrastructure/queue/bullmq.helpers';

@Injectable()
export class BullMqSchedulerJobQueue implements SchedulerJobQueuePort {
  private readonly logger = new Logger(BullMqSchedulerJobQueue.name);

  constructor(
    @InjectQueue(SCHEDULER_QUEUE_NAME)
    private readonly queue: Queue<SchedulerQueuedJob>,
    private readonly configService: ConfigService,
  ) {}

  async enqueue(job: SchedulerQueuedJob): Promise<void> {
    const { jobAttempts } = this.configService.getScheduler();
    try {
      await this.queue.add(SCHEDULER_JOB_NAME, job, {
        jobId: job.idempotencyKey,
        attempts: jobAttempts,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: true,
      });
    } catch (err) {
      if (isDuplicateJobError(err)) {
        this.logger.warn(
          `Duplicate enqueue ignored for job ${job.jobId} (idempotencyKey=${job.idempotencyKey})`,
        );
        return;
      }
      throw err;
    }
  }
}
