import { Inject, Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { ImportHandlerRegistry } from '../import-handler.registry';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';

@Injectable()
export class InitImportUseCase {
  constructor(
    private readonly registry: ImportHandlerRegistry,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
  ) {}

  async execute(input: { entityKey: string; tenantId?: string }) {
    input = { ...input, tenantId: input.tenantId ?? this.requestContext.getTenantId() };
    const descriptor = this.registry.resolveDescriptor(input.entityKey);
    const recent = await this.jobs.list({
      tenantId: input.tenantId,
      entityKey: input.entityKey,
      page: 1,
      pageSize: 5,
    });
    return {
      descriptor,
      limits: {
        maxRows: descriptor.maxRows,
        maxFileSizeBytes: descriptor.maxFileSizeBytes,
      },
      recentJobs: recent.items,
    };
  }
}
