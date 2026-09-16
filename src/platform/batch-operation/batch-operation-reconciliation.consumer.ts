import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { BatchOperationJobRepositoryPort } from './ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from './ports/batch-operation-job-row-repository.port';
import { BatchOperationQueuePublisherPort } from './ports/batch-operation-queue-publisher.port';
import { BatchOperationJobOutboxWriterPort } from './ports/batch-operation-job-outbox-writer.port';

/**
 * PHASE 8.4. Crash convergence for the batch pipeline:
 *  1. Release/abandon rows stuck PROCESSING past the reconciliation window
 *     (claim tokens are bumped so the stale worker can no longer settle them).
 *  2. Recompute header counters from row truth.
 *  3. Finalise non-terminal jobs whose rows are all settled — closes the
 *     crash window between a row's terminal write and its counter bump
 *     (jobs the chunk fan-out would otherwise leave RUNNING forever).
 *  4. Re-dispatch PENDING rows of Async jobs whose BullMQ fan-out was lost.
 * One poisoned job can no longer block the cycle: every per-job step has its
 * own error isolation.
 */
@Injectable()
export class BatchOperationReconciliationConsumer {
  private readonly logger = new Logger(BatchOperationReconciliationConsumer.name);
  private running = false;

  constructor(
    private readonly jobs: BatchOperationJobRepositoryPort,
    private readonly rows: BatchOperationJobRowRepositoryPort,
    private readonly queuePublisher: BatchOperationQueuePublisherPort,
    private readonly outboxWriter: BatchOperationJobOutboxWriterPort,
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
        this.logger.warn(`Released ${reset} batch rows stuck in PROCESSING`);
      }

      const recounted = await this.jobs.recountJobCounters();
      if (recounted > 0) {
        this.logger.log(`Recomputed counters for ${recounted} batch jobs from row truth`);
      }

      await this.finaliseCompletedJobs();
      await this.redispatchOrphanedChunks();
    } catch (err) {
      this.logger.error(`Batch reconciliation cycle failed: ${FailureMessage.of(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async finaliseCompletedJobs(): Promise<void> {
    const completable = await this.jobs.findCompletableJobs();
    for (const candidate of completable) {
      try {
        const finalised = await this.jobs.finaliseJob(candidate.id);
        if (!finalised) {
          continue;
        }
        this.logger.warn(
          `Finalised batch job ${finalised.jobNo} from reconciliation (all rows settled)`,
        );
        await this.outboxWriter.writeJobCompletedEvent(finalised);
      } catch (err) {
        this.logger.error(
          `Reconciliation finalise failed for batch job ${candidate.id}: ${FailureMessage.of(err)}`,
        );
      }
    }
  }

  private async redispatchOrphanedChunks(): Promise<void> {
    const resumable = await this.jobs.findResumableJobs();
    for (const job of resumable) {
      try {
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
      } catch (err) {
        this.logger.error(
          `Re-dispatch failed for batch job ${job.id}, continuing cycle: ${FailureMessage.of(err)}`,
        );
      }
    }
  }
}
