import { Injectable } from '@nestjs/common';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { GetBatchOperationJobStatusPort } from '../ports/get-batch-operation-job-status.port';
import { BatchOperationJobNotFoundError } from '../batch-operation.errors';
import { BatchOperationJobRecord } from '../batch-operation.types';

/** Job header + aggregated counters for progress polling. */
@Injectable()
export class GetBatchOperationJobStatusUseCase implements GetBatchOperationJobStatusPort {
  constructor(private readonly repository: BatchOperationJobRepositoryPort) {}

  async execute(jobId: string): Promise<BatchOperationJobRecord> {
    const job = await this.repository.findJob(jobId);
    if (!job) {
      throw new BatchOperationJobNotFoundError(jobId);
    }
    return job;
  }
}
