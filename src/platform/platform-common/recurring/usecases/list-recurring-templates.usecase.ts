import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { RecurringTemplateRepositoryPort } from '../ports/recurring-template-repository.port';
import { RecurringTemplateRecord } from '../recurring-template.types';

@Injectable()
export class ListRecurringTemplatesUseCase {
  constructor(
    private readonly templateRepository: RecurringTemplateRepositoryPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  execute(filter: {
    tenantId?: string;
    status?: RecurringTemplateRecord['status'];
    limit?: number;
    offset?: number;
  }): Promise<RecurringTemplateRecord[]> {
    return this.templateRepository.list({
      ...filter,
      tenantId: filter.tenantId ?? this.requestContext.getTenantId(),
    });
  }
}
