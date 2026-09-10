import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { ImportJobRepositoryPort } from './ports/import-job-repository.port';
import { ImportJobRowRepositoryPort } from './ports/import-job-row-repository.port';
import { ImportJobOutboxWriterPort } from './ports/import-job-outbox-writer.port';

@Injectable()
export class ImportReconciliationConsumer {
  private readonly logger = new Logger(ImportReconciliationConsumer.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcileStaleJobs(): Promise<void> {
    const windowMs = this.config.getImport().reconciliationWindowMs;
    const olderThan = new Date(Date.now() - windowMs);

    const reset = await this.rows.resetStaleProcessing(olderThan);
    if (reset > 0) {
      this.logger.warn(`Reset ${reset} stale PROCESSING import rows to PENDING`);
    }

    const stale = await this.jobs.findStaleJobs(olderThan);
    for (const job of stale) {
      this.logger.warn(`Failing stale import job ${job.id} (status=${job.status})`);
      const failed = await this.jobs.markTerminal(job.id, 'FAILED', {
        from: job.status,
        to: 'FAILED',
        at: new Date(),
        detail: 'reconciliation: heartbeat stale',
      });
      await this.outbox.writeFailedEvent(failed);
    }
  }
}
