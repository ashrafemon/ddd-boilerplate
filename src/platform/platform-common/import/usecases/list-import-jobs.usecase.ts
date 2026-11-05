import { Inject, Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { PageResult } from '@shared-kernel/types/pagination';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRecord } from '../import.types';

@Injectable()
export class ListImportJobsUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
  ) {}

  execute(input: {
    tenantId?: string;
    status?: ImportJobRecord['status'];
    entityKey?: string;
    page: number;
    pageSize: number;
  }): Promise<PageResult<ImportJobRecord>> {
    return this.jobs.list({
      ...input,
      tenantId: input.tenantId ?? this.requestContext.getTenantId(),
    });
  }
}
