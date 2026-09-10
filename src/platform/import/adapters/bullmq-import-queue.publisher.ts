import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@config/config.service';
import { ImportQueuePublisherPort } from '../ports/import-queue-publisher.port';
import {
  IMPORT_EXECUTE_JOB_NAME,
  IMPORT_PARSE_JOB_NAME,
  IMPORT_QUEUE_NAME,
  IMPORT_VALIDATE_JOB_NAME,
} from '../import.constants';

export type ImportQueuePayload = { jobId: string };

@Injectable()
export class BullMqImportQueuePublisher implements ImportQueuePublisherPort {
  private readonly logger = new Logger(BullMqImportQueuePublisher.name);

  constructor(
    @InjectQueue(IMPORT_QUEUE_NAME)
    private readonly queue: Queue<ImportQueuePayload>,
    private readonly configService: ConfigService,
  ) {}

  async enqueueParse(jobId: string): Promise<void> {
    await this.add(IMPORT_PARSE_JOB_NAME, jobId);
  }

  async enqueueValidate(jobId: string): Promise<void> {
    await this.add(IMPORT_VALIDATE_JOB_NAME, jobId);
  }

  async enqueueExecute(jobId: string): Promise<void> {
    await this.add(IMPORT_EXECUTE_JOB_NAME, jobId);
  }

  private async add(name: string, jobId: string): Promise<void> {
    const { jobAttempts } = this.configService.getImport();
    try {
      await this.queue.add(
        name,
        { jobId },
        {
          jobId: `${name}:${jobId}`,
          attempts: jobAttempts,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: true,
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to enqueue ${name} for import job ${jobId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw err;
    }
  }
}
