import { Logger } from '@nestjs/common';
import { ParseImportJobUseCase } from '../usecases/parse-import-job.usecase';
import { RunImportExecutionUseCase } from '../usecases/run-import-execution.usecase';
import { ValidateImportJobUseCase } from '../usecases/validate-import-job.usecase';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  IMPORT_EXECUTE_JOB_NAME,
  IMPORT_PARSE_JOB_NAME,
  IMPORT_QUEUE_NAME,
  IMPORT_VALIDATE_JOB_NAME,
  IMPORT_WORKER_CONCURRENCY,
} from '../import.constants';
import { ImportQueuePayload } from './bullmq-import-queue.adapter';

@Processor(IMPORT_QUEUE_NAME, { concurrency: IMPORT_WORKER_CONCURRENCY })
export class BullMqImportWorker extends WorkerHost {
  private readonly logger = new Logger(BullMqImportWorker.name);

  constructor(
    private readonly parseJob: ParseImportJobUseCase,
    private readonly validateJob: ValidateImportJobUseCase,
    private readonly runExecution: RunImportExecutionUseCase,
  ) {
    super();
  }

  async process(job: Job<ImportQueuePayload>): Promise<void> {
    const { jobId } = job.data;
    switch (job.name) {
      case IMPORT_PARSE_JOB_NAME:
        await this.parseJob.execute(jobId);
        return;
      case IMPORT_VALIDATE_JOB_NAME:
        await this.validateJob.execute(jobId);
        return;
      case IMPORT_EXECUTE_JOB_NAME:
        await this.runExecution.execute(jobId);
        return;
      default:
        this.logger.warn(`Unknown import job name '${job.name}' for ${jobId}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ImportQueuePayload> | undefined, err: Error): void {
    if (!job) return;
    this.logger.error(`Import queue job ${job.name}:${job.data.jobId} failed: ${err.message}`);
  }
}
