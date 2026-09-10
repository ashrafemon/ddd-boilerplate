import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { NumberingPort } from '@platform/numbering/ports/numbering.port';
import { BatchOperationHandlerRegistry } from '../batch-operation-handler.registry';
import { BatchOperationWorker } from '../batch-operation.worker';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { BatchOperationQueuePublisherPort } from '../ports/batch-operation-queue-publisher.port';
import { CreateBatchOperationJobPort } from '../ports/create-batch-operation-job.port';
import { BatchSelectionTooLargeError, EmptyBatchSelectionError } from '../batch-operation.errors';
import {
  BatchOperationDispatch,
  BatchOperationJobRecord,
  BatchOperationMode,
  SubmitBatchOperationInput,
} from '../batch-operation.types';

const JOB_NUMBER_SEQUENCE = 'batch-operation-job';

/**
 * PHASE 2–3. Validates the selection against policy, decides Sync vs Async,
 * creates the job header and one Pending row per record in ONE transaction,
 * then dispatches. Never interprets what operationCode does.
 */
@Injectable()
export class CreateBatchOperationJobUseCase implements CreateBatchOperationJobPort {
  constructor(
    private readonly repository: BatchOperationJobRepositoryPort,
    private readonly registry: BatchOperationHandlerRegistry,
    private readonly worker: BatchOperationWorker,
    private readonly queuePublisher: BatchOperationQueuePublisherPort,
    private readonly numbering: NumberingPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: SubmitBatchOperationInput): Promise<BatchOperationJobRecord> {
    this.registry.resolveHandler(input.aggregateType);
    this.registry.assertOperationSupported(input.aggregateType, input.operationCode);

    const entityIds = [...new Set(input.entityIds.filter(id => id && id.trim().length > 0))];
    if (entityIds.length === 0) {
      throw new EmptyBatchSelectionError();
    }

    const { maxRecordsPerJob, syncThreshold } = this.configService.getBatchOperation();
    if (entityIds.length > maxRecordsPerJob) {
      throw new BatchSelectionTooLargeError(entityIds.length, maxRecordsPerJob);
    }

    const mode: BatchOperationMode = entityIds.length <= syncThreshold ? 'SYNC' : 'ASYNC';
    const jobNo = await this.numbering.nextNumber(JOB_NUMBER_SEQUENCE, {
      prefix: 'BATCH-',
      padding: 6,
    });

    const job = await this.repository.createJobWithRows(
      {
        jobNo,
        aggregateType: input.aggregateType,
        operationCode: input.operationCode,
        operationParams: input.params ?? null,
        mode,
        status: mode === 'SYNC' ? 'RUNNING' : 'PENDING',
        tenantId: input.tenantId ?? null,
        companyId: input.companyId ?? null,
        branchId: input.branchId ?? null,
        requestedBy: input.requestedBy ?? null,
      },
      entityIds,
    );

    const dispatch: BatchOperationDispatch = {
      jobId: job.id,
      aggregateType: job.aggregateType,
      operationCode: job.operationCode,
      params: job.operationParams ?? undefined,
      tenantId: job.tenantId ?? undefined,
      requestedBy: job.requestedBy ?? undefined,
      traceId: input.traceId,
      rowIds: (job.rows ?? []).map(row => row.id),
    };

    if (mode === 'SYNC') {
      // Producer/Consumer half skipped — same worker code path either way.
      await this.worker.processChunk(dispatch);
      return (await this.repository.findJobWithRows(job.id)) ?? job;
    }

    try {
      await this.queuePublisher.dispatchChunks(dispatch);
    } catch (err) {
      await this.repository.finaliseJob(job.id);
      throw err;
    }
    return job;
  }
}
