import { Injectable } from '@nestjs/common';
import { RecurringTemplatePort } from '../ports/recurring-template.port';
import { CreateRecurringTemplateUseCase } from '../usecases/create-recurring-template.usecase';
import { CreateRecurringTemplateInput, RecurringTemplateRecord } from '../recurring-template.types';

/**
 * Thin inbound adapter (platform-service convention): the only thing that
 * implements RecurringTemplatePort, delegating to the module's own use case.
 */
@Injectable()
export class RecurringTemplateAdapter implements RecurringTemplatePort {
  constructor(private readonly createTemplate: CreateRecurringTemplateUseCase) {}

  create(input: CreateRecurringTemplateInput): Promise<RecurringTemplateRecord> {
    return this.createTemplate.execute(input);
  }
}
