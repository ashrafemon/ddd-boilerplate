import { Inject, Injectable } from '@nestjs/common';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRowRepositoryPort } from '../ports/import-job-row-repository.port';
import { requireVisibleJob } from './import-helpers';

@Injectable()
export class GetImportReportUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
  ) {}

  async execute(input: { jobId: string; tenantId?: string; page: number; pageSize: number }) {
    const job = await requireVisibleJob(this.jobs, input.jobId, input.tenantId);
    const { rows, total } = await this.rows.listByJob(job.id, {
      page: input.page,
      pageSize: input.pageSize,
      validationStatus: 'INVALID',
    });
    return {
      job,
      errorRows: {
        items: rows,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      },
    };
  }
}
