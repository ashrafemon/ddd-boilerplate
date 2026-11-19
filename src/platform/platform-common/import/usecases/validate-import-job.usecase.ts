import { Inject, Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ValidateImportJobService } from '../services/validate-import-job.service';

@Injectable()
export class ValidateImportJobUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
    private readonly validation: ValidateImportJobService,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) return;
    await this.requestContext.run({ tenantId: job.tenantId, correlationId: job.traceId }, () =>
      this.validation.process(jobId),
    );
  }
}
