import { Inject, Injectable } from '@nestjs/common';
import { ImportJobOutboxWriterPort } from '../ports/import-job-outbox-writer.port';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { AuditPort } from '@platform/audit/ports/audit.port';
import { ImportJobRecord } from '../import.types';
import { requireVisibleJob } from './import-helpers';

@Injectable()
export class CancelImportJobUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
    @Inject(AuditPort) private readonly audit: AuditPort,
  ) {}

  async execute(input: {
    jobId: string;
    tenantId?: string;
    actor?: string;
  }): Promise<ImportJobRecord> {
    const job = await requireVisibleJob(this.jobs, input.jobId, input.tenantId);
    const terminal = ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED'];
    if (terminal.includes(job.status)) {
      return job;
    }
    await this.jobs.setCancelRequested(job.id);
    if (['PENDING_UPLOAD', 'UPLOADED', 'MAPPED', 'VALIDATED'].includes(job.status)) {
      const cancelled = await this.jobs.markTerminal(job.id, 'CANCELLED', {
        from: job.status,
        to: 'CANCELLED',
        at: new Date(),
        actor: input.actor,
      });
      if (cancelled) {
        await this.outbox.writeCancelledEvent(cancelled);
        await this.audit.record({
          action: 'import.cancelled',
          entityType: 'ImportJob',
          entityId: job.id,
          changes: { status: 'CANCELLED', entityKey: job.entityKey },
        });
        return cancelled;
      }
    }
    return (await this.jobs.findById(job.id))!;
  }
}
