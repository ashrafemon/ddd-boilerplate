import { Injectable, Logger } from '@nestjs/common';
import { BatchOperationHandlerRegistry } from '../batch-operation-handler.registry';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from '../ports/batch-operation-job-row-repository.port';
import { BatchOperationContext, BatchOperationDispatch } from '../batch-operation.types';
import { ProcessBatchOperationRowService } from '../services/process-batch-operation-row.service';

/**
 * PHASE 5 — one row. Cancel check, claim, and fan-out to the per-row service
 * that resolves the handler and settles the outcome. Handler resolution and
 * result mapping live in `ProcessBatchOperationRowService` so this use case
 * stays a single `execute()` entry point.
 */
@Injectable()
export class ProcessBatchOperationRowUseCase {
  private readonly logger = new Logger(ProcessBatchOperationRowUseCase.name);

  constructor(
    private readonly jobs: BatchOperationJobRepositoryPort,
    private readonly rows: BatchOperationJobRowRepositoryPort,
    private readonly registry: BatchOperationHandlerRegistry,
    private readonly processor: ProcessBatchOperationRowService,
  ) {}

  async execute(
    dispatch: BatchOperationDispatch,
    rowId: string,
  ): Promise<'PROCESSED' | 'SKIPPED_CLAIM' | 'CANCELLED'> {
    if (await this.jobs.isCancelRequested(dispatch.jobId)) {
      return 'CANCELLED';
    }

    const claimed = await this.rows.claimRow(rowId);
    if (!claimed) {
      return 'SKIPPED_CLAIM';
    }
    if (await this.jobs.isCancelRequested(dispatch.jobId)) {
      // Claimed after cancel raced in: hand the row back unstalled.
      await this.rows.settleRow(claimed.id, dispatch.jobId, claimed.claimToken, {
        outcome: 'SKIPPED',
        skipReason: 'CANCELLED_BY_REQUEST',
        processingTimeMs: 0,
      });
      return 'CANCELLED';
    }

    const handler = this.registry.resolveHandler(dispatch.aggregateType);
    const context: BatchOperationContext = {
      tenantId: dispatch.tenantId,
      batchOperationJobId: dispatch.jobId,
      requestedBy: dispatch.requestedBy,
      traceId: dispatch.traceId,
    };

    try {
      return await this.processor.run(handler, claimed, dispatch, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Batch row ${claimed.id} (${dispatch.aggregateType}/${dispatch.operationCode}) failed: ${message}`,
      );
      await this.rows.settleRow(claimed.id, dispatch.jobId, claimed.claimToken, {
        outcome: 'FAILED',
        errorMessage: message,
        processingTimeMs: 0,
      });
      return 'PROCESSED';
    }
  }
}
