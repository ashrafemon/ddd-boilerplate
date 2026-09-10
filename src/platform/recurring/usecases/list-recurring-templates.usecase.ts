import { Injectable } from '@nestjs/common';
import { RecurringTemplateRepositoryPort } from '../ports/recurring-template-repository.port';
import { RecurringTemplateRecord } from '../recurring-template.types';

@Injectable()
export class ListRecurringTemplatesUseCase {
  constructor(private readonly templateRepository: RecurringTemplateRepositoryPort) {}

  execute(filter: {
    tenantId?: string;
    status?: RecurringTemplateRecord['status'];
  }): Promise<RecurringTemplateRecord[]> {
    return this.templateRepository.list(filter);
  }
}
