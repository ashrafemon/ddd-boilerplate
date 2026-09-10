import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { BatchOperationJobRepositoryPort } from './ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from './ports/batch-operation-job-row-repository.port';
import { BatchOperationQueuePublisherPort } from './ports/batch-operation-queue-publisher.port';

/**
 * PHASE 8.4. Finds rows stuck PROCESSING past the reconciliation window
 * (worker died between claim and status write) and re-dispatches orphaned
 * PENDING rows whose Async enqueue was lost. The 5.1 claim-or-skip makes
 * re-processing safe.
 */
@Injectable()
export class BatchOperationReconciliationConsumer {
  private readonly logger = new Logger(BatchOperationReconciliationConsumer.name);
  private running = false;

  constructor(
    private readonly jobs: BatchOperationJobRepositoryPort,
    private readonly rows: BatchOperationJobRowRepositoryPort,
    private readonly queuePublisher: BatchOperationQueuePublisherPort,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'batch-operation-reconciliation' })
  async reconcile(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const { reconciliationWindowMs } = this.configService.getBatchOperation();

      const reset = await this.rows.resetStuckRows(reconciliationWindowMs);
      if (reset > 0) {
        this.logger.warn(`Reset ${reset} batch rows stuck in PROCESSING`);
      }

      const resumable = await this.jobs.findResumableJobs();
      for (const job of resumable) {
        const rowIds = await this.rows.rowIds(job.id, 'PENDING');
        if (rowIds.length === 0) {
          continue;
        }
        this.logger.warn(
          `Re-dispatching ${rowIds.length} PENDING rows for batch job ${job.jobNo} (${job.id})`,
        );
        await this.queuePublisher.dispatchChunks({
          jobId: job.id,
          aggregateType: job.aggregateType,
          operationCode: job.operationCode,
          params: job.operationParams ?? undefined,
          tenantId: job.tenantId ?? undefined,
          requestedBy: job.requestedBy ?? undefined,
          traceId: undefined,
          rowIds,
        });
      }
    } finally {
      this.running = false;
    }
  }
}
