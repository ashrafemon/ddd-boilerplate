import { Injectable, NotFoundException } from '@nestjs/common';
import { RecurringTemplateRepositoryPort } from '../ports/recurring-template-repository.port';
import { RecurringTemplateRecord } from '../recurring-template.types';

@Injectable()
export class GetRecurringTemplateUseCase {
  constructor(private readonly templateRepository: RecurringTemplateRepositoryPort) {}

  async execute(id: string): Promise<RecurringTemplateRecord> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new NotFoundException('RecurringTemplate not found');
    }
    return template;
  }
}
