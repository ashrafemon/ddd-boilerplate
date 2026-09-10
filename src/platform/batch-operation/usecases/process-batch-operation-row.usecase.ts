import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { BatchOperationHandlerRegistry } from '../batch-operation-handler.registry';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from '../ports/batch-operation-job-row-repository.port';
import { ProcessBatchOperationRowPort } from '../ports/process-batch-operation-row.port';
import {
  BatchOperationContext,
  BatchOperationDispatch,
  BatchOperationSkipReason,
} from '../batch-operation.types';

const KNOWN_SKIP_REASONS: readonly BatchOperationSkipReason[] = [
  'ALREADY_IN_TARGET_STATE',
  'VALIDATION_FAILED',
  'PERMISSION_DENIED',
];

/**
 * PHASE 5 — one row. Handler resolution and result mapping live here so the
 * worker stays a thin chunk loop.
 */
@Injectable()
export class ProcessBatchOperationRowUseCase implements ProcessBatchOperationRowPort {
  private readonly logger = new Logger(ProcessBatchOperationRowUseCase.name);

  constructor(
    private readonly jobs: BatchOperationJobRepositoryPort,
    private readonly rows: BatchOperationJobRowRepositoryPort,
    private readonly registry: BatchOperationHandlerRegistry,
    private readonly configService: ConfigService,
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

    const handler = this.registry.resolveHandler(dispatch.aggregateType);
    const context: BatchOperationContext = {
      tenantId: dispatch.tenantId,
      batchOperationJobId: dispatch.jobId,
      requestedBy: dispatch.requestedBy,
      traceId: dispatch.traceId,
    };
    const { resultSnapshotMaxBytes } = this.configService.getBatchOperation();
    const startedAt = Date.now();

    try {
      const verdict = await handler.validate(
        claimed.entityId,
        dispatch.operationCode,
        dispatch.params,
        context,
      );

      if (!verdict.canProceed) {
        await this.rows.markRowSkipped(
          claimed.id,
          normaliseSkipReason(verdict.reason),
          Date.now() - startedAt,
        );
        await this.jobs.incrementProgress(dispatch.jobId, 'SKIPPED');
        return 'PROCESSED';
      }

      const result = await handler.execute(
        claimed.entityId,
        dispatch.operationCode,
        dispatch.params,
        context,
      );

      await this.rows.markRowSuccess(
        claimed.id,
        capSnapshot(result.resultSnapshot ?? null, resultSnapshotMaxBytes),
        Date.now() - startedAt,
      );
      await this.jobs.incrementProgress(dispatch.jobId, 'SUCCESS');
      return 'PROCESSED';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Batch row ${claimed.id} (${dispatch.aggregateType}/${dispatch.operationCode}) failed: ${message}`,
      );
      await this.rows.markRowFailed(claimed.id, message, Date.now() - startedAt);
      await this.jobs.incrementProgress(dispatch.jobId, 'FAILED');
      return 'PROCESSED';
    }
  }
}

function normaliseSkipReason(reason: string | undefined): string {
  if (reason && (KNOWN_SKIP_REASONS as readonly string[]).includes(reason)) {
    return reason;
  }
  return reason ? `VALIDATION_FAILED: ${reason}`.slice(0, 200) : 'VALIDATION_FAILED';
}

function capSnapshot(
  snapshot: Record<string, unknown> | null,
  maxBytes: number,
): Record<string, unknown> | null {
  if (!snapshot) {
    return null;
  }
  const size = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
  if (size <= maxBytes) {
    return snapshot;
  }
  return { _truncated: true, _originalBytes: size };
}
