import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { TenantScope } from '@common/application/utils/tenant-scope';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRecord } from '../import.types';

@Injectable()
export class GetImportJobStatusUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
  ) {}

  async execute(input: { jobId: string; tenantId?: string }): Promise<ImportJobRecord> {
    const job = await this.jobs.findById(input.jobId);
    if (!job) {
      throw new NotFoundException(`ImportJob '${input.jobId}' not found`);
    }
    TenantScope.assertVisible(
      job.tenantId ?? null,
      input.tenantId ?? this.requestContext.getTenantId(),
    );
    return job;
  }
}
