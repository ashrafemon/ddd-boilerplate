import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportQueuePublisherPort } from '../ports/import-queue-publisher.port';
import { AuditPort } from '@platform/audit/ports/audit.port';
import { ImportJobRecord } from '../import.types';
import { requireVisibleJob } from './import-helpers';

@Injectable()
export class ExecuteImportJobUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportQueuePublisherPort) private readonly queue: ImportQueuePublisherPort,
    @Inject(AuditPort) private readonly audit: AuditPort,
  ) {}

  async execute(input: {
    jobId: string;
    tenantId?: string;
    actor?: string;
  }): Promise<ImportJobRecord> {
    const job = await requireVisibleJob(this.jobs, input.jobId, input.tenantId);
    if (job.status !== 'VALIDATED') {
      throw new ConflictException(
        `ImportJob '${job.id}' is ${job.status}; expected one of: VALIDATED`,
      );
    }
    const updated = await this.jobs.transitionStatus(job.id, 'VALIDATED', 'EXECUTING', {
      from: 'VALIDATED',
      to: 'EXECUTING',
      at: new Date(),
      actor: input.actor,
    });
    await this.queue.enqueueExecute(job.id);
    await this.audit.record({
      action: 'import.execute-requested',
      entityType: 'ImportJob',
      entityId: job.id,
      changes: { status: 'EXECUTING', entityKey: job.entityKey },
    });
    return updated;
  }
}
/** Renewing stage lock: acquire once, heartbeat while the phase runs, release at the end. */
