import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { FileStoragePort } from '@platform/storage/ports/file-storage.port';
import { ImportJobRepositoryPort } from './ports/import-job-repository.port';
import { ImportJobRowRepositoryPort } from './ports/import-job-row-repository.port';
import { ImportQueuePublisherPort } from './ports/import-queue-publisher.port';
import { StorageObjectRepositoryPort } from './ports/storage-object-repository.port';

const STORAGE_SWEEP_BATCH = 200;

/**
 * Crash convergence, NOT job killing: a stale-heartbeat job is only stale if
 * nobody holds its stage lock. The reconciler acquires the lock itself — if
 * that succeeds, the previous worker is gone, so the current stage is
 * re-enqueued (parse deletes-and-reinserts, validate/execute continue over
 * unclaimed rows) rather than failing a half-finished job. Terminalising here
 * would race a slow-but-live phase; resuming is idempotent and safe.
 *
 * Also purges storage objects whose upload slot was never used or whose
 * retention lapsed (files + rows together).
 */
@Injectable()
export class ImportReconciliationConsumer {
  private readonly logger = new Logger(ImportReconciliationConsumer.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    @Inject(ImportQueuePublisherPort) private readonly queue: ImportQueuePublisherPort,
    @Inject(StorageObjectRepositoryPort)
    private readonly storageObjects: StorageObjectRepositoryPort,
    private readonly fileStorage: FileStoragePort,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'import-reconciliation' })
  async reconcile(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.resumeOrphanedStages();
      await this.purgeExpiredStorage();
    } catch (err) {
      this.logger.error(`Import reconciliation cycle failed: ${FailureMessage.of(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async resumeOrphanedStages(): Promise<void> {
    const cfg = this.config.getImport();
    const olderThan = new Date(Date.now() - cfg.reconciliationWindowMs);

    const reset = await this.rows.resetStaleProcessing(olderThan);
    if (reset > 0) {
      this.logger.warn(`Reset ${reset} stale PROCESSING import rows to PENDING`);
    }

    const stale = await this.jobs.findStaleJobs(olderThan);
    for (const job of stale) {
      try {
        const takeoverId = `reconcile:${Date.now()}`;
        const acquired = await this.jobs.tryAcquireLock(
          job.id,
          takeoverId,
          new Date(Date.now() + cfg.lockTtlMs),
        );
        if (!acquired) {
          continue; // a live stage owns it; heartbeat will refresh below
        }
        try {
          const stage = ImportReconciliationConsumer.stageFor(job.status);
          if (!stage) {
            const failed = await this.jobs.markTerminal(job.id, 'FAILED', {
              from: job.status,
              to: 'FAILED',
              at: new Date(),
              detail: 'reconciliation: stale stage not resumable',
            });
            if (failed) {
              this.logger.warn(`Failed unrecoverable stale import job ${job.id}`);
            }
            continue;
          }
          this.logger.warn(
            `Resuming stale import job ${job.id} (status=${job.status}) via ${stage} re-enqueue`,
          );
          if (stage === 'parse') {
            await this.queue.enqueueParse(job.id);
          } else if (stage === 'validate') {
            await this.queue.enqueueValidate(job.id);
          } else {
            await this.queue.enqueueExecute(job.id);
          }
        } finally {
          await this.jobs.releaseLock(job.id, takeoverId);
        }
      } catch (err) {
        this.logger.error(
          `Reconciliation failed for import job ${job.id}, continuing cycle: ${FailureMessage.of(err)}`,
        );
      }
    }
  }

  private async purgeExpiredStorage(): Promise<void> {
    const expired = await this.storageObjects.findExpired(new Date(), STORAGE_SWEEP_BATCH);
    for (const obj of expired) {
      try {
        try {
          await this.fileStorage.delete(obj.storageKey);
        } catch (err) {
          // Missing/unreachable object files must not block row cleanup.
          this.logger.warn(
            `File delete failed for expired storage object ${obj.id}: ${FailureMessage.of(err)}`,
          );
        }
        await this.storageObjects.deleteById(obj.id);
      } catch (err) {
        this.logger.error(`Storage purge failed for object ${obj.id}: ${FailureMessage.of(err)}`);
      }
    }
    if (expired.length > 0) {
      this.logger.log(`Purged ${expired.length} expired storage objects`);
    }
  }

  /** Map a half-finished status to the queue stage that can safely resume it. */
  private static stageFor(status: string): 'parse' | 'validate' | 'execute' | null {
    switch (status) {
      case 'PARSING':
        return 'parse';
      case 'VALIDATING':
        return 'validate';
      case 'EXECUTING':
        return 'execute';
      default:
        return null;
    }
  }
}
