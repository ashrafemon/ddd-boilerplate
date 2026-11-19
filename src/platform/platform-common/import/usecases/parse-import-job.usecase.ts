import { Inject, Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ParseImportJobService } from '../services/parse-import-job.service';

@Injectable()
export class ParseImportJobUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
    private readonly parser: ParseImportJobService,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) return;
    await this.requestContext.run({ tenantId: job.tenantId, correlationId: job.traceId }, () =>
      this.parser.process(jobId),
    );
  }
}
