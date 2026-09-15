import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportQueuePublisherPort } from '../ports/import-queue-publisher.port';
import { ColumnMapping, ImportJobRecord } from '../import.types';
import { requireVisibleJob } from './import-helpers';

@Injectable()
export class UpdateImportMappingUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportQueuePublisherPort) private readonly queue: ImportQueuePublisherPort,
  ) {}

  async execute(input: {
    jobId: string;
    mapping: ColumnMapping;
    tenantId?: string;
    actor?: string;
  }): Promise<ImportJobRecord> {
    const job = await requireVisibleJob(this.jobs, input.jobId, input.tenantId);
    if (job.status !== 'MAPPED' && job.status !== 'UPLOADED' && job.status !== 'PARSING') {
      // allow mapping update when MAPPED (re-map before validate)
    }
    if (!['MAPPED'].includes(job.status)) {
      throw new ConflictException(
        `ImportJob '${job.id}' is ${job.status}; expected one of: MAPPED`,
      );
    }
    const required = job.descriptorSnapshot.fields.filter(f => f.required).map(f => f.targetField);
    const mappedTargets = new Set(Object.values(input.mapping));
    const missing = required.filter(f => !mappedTargets.has(f));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Mapping for '${job.entityKey}' is incomplete; missing required fields: ${missing.join(', ')}`,
      );
    }
    let updated = await this.jobs.setColumnMapping(job.id, input.mapping);
    updated = await this.jobs.transitionStatus(job.id, 'MAPPED', 'VALIDATING', {
      from: 'MAPPED',
      to: 'VALIDATING',
      at: new Date(),
      actor: input.actor,
      detail: 'mapping confirmed',
    });
    await this.queue.enqueueValidate(job.id);
    return updated;
  }
}
