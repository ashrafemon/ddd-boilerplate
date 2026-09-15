import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { ImportFileParser } from '../import-file.parser';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRowRepositoryPort } from '../ports/import-job-row-repository.port';
import { requireVisibleJob } from './import-helpers';

@Injectable()
export class GetImportPreviewUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    private readonly config: ConfigService,
    private readonly parser: ImportFileParser,
  ) {}

  async execute(input: { jobId: string; tenantId?: string }) {
    const job = await requireVisibleJob(this.jobs, input.jobId, input.tenantId);
    const previewLimit = this.config.getImport().previewRows;
    const { rows } = await this.rows.listByJob(job.id, { page: 1, pageSize: previewLimit });
    const sourceColumns = rows[0]?.rawPayload ? Object.keys(rows[0].rawPayload) : [];
    const suggestedMapping =
      job.columnMapping ?? this.parser.suggestMapping(sourceColumns, job.descriptorSnapshot);
    return {
      job,
      sheets: ['Sheet1'],
      headerRow: 1,
      sourceColumns,
      suggestedMapping,
      sampleRows: rows.map(r => r.rawPayload ?? {}),
    };
  }
}
