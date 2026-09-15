import { Inject, Injectable } from '@nestjs/common';
import { PageResult } from '@shared-kernel/types/pagination';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRecord } from '../import.types';

@Injectable()
export class ListImportJobsUseCase {
  constructor(@Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort) {}

  execute(input: {
    tenantId?: string;
    status?: ImportJobRecord['status'];
    entityKey?: string;
    page: number;
    pageSize: number;
  }): Promise<PageResult<ImportJobRecord>> {
    return this.jobs.list(input);
  }
}
