import { Injectable } from '@nestjs/common';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { ImportJobOutboxWriterPort } from '../ports/import-job-outbox-writer.port';
import { ImportJobCompletedEvent } from '../events/import-job-completed.event';
import { ImportJobFailedEvent } from '../events/import-job-failed.event';
import { ImportJobCancelledEvent } from '../events/import-job-cancelled.event';
import { ImportJobRecord } from '../import.types';

@Injectable()
export class PrismaImportJobOutboxWriter implements ImportJobOutboxWriterPort {
  constructor(private readonly outbox: OutboxWriterPort) {}

  async writeCompletedEvent(job: ImportJobRecord): Promise<void> {
    const status = job.status === 'COMPLETED_WITH_ERRORS' ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
    await this.outbox.append(
      new ImportJobCompletedEvent(
        job.id,
        job.jobNo,
        job.entityKey,
        status,
        job.totalRows,
        job.appliedRows,
        job.failedRows,
        job.invalidRows,
        job.tenantId,
        job.traceId,
      ),
      'ImportJob',
      job.id,
    );
  }

  async writeFailedEvent(job: ImportJobRecord): Promise<void> {
    await this.outbox.append(
      new ImportJobFailedEvent(
        job.id,
        job.jobNo,
        job.entityKey,
        'FAILED',
        job.totalRows,
        job.appliedRows,
        job.failedRows,
        job.invalidRows,
        job.tenantId,
        job.traceId,
      ),
      'ImportJob',
      job.id,
    );
  }

  async writeCancelledEvent(job: ImportJobRecord): Promise<void> {
    await this.outbox.append(
      new ImportJobCancelledEvent(
        job.id,
        job.jobNo,
        job.entityKey,
        'CANCELLED',
        job.totalRows,
        job.appliedRows,
        job.failedRows,
        job.invalidRows,
        job.tenantId,
        job.traceId,
      ),
      'ImportJob',
      job.id,
    );
  }
}
