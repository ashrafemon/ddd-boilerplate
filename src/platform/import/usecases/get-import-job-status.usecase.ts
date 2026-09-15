import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRecord } from '../import.types';

@Injectable()
export class GetImportJobStatusUseCase {
  constructor(@Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort) {}

  async execute(input: { jobId: string; tenantId?: string }): Promise<ImportJobRecord> {
    const job = await this.requireJob(input.jobId, input.tenantId);
    return job;
  }

  private async requireJob(jobId: string, tenantId?: string) {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new NotFoundException(`ImportJob '${jobId}' not found`);
    }
    TenantScope.assertVisible(job.tenantId ?? null, tenantId);
    return job;
  }
}
