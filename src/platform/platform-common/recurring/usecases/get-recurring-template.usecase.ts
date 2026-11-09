import { TenantScope } from '@common/application/utils/tenant-scope';
import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RecurringTemplateRepositoryPort } from '../ports/recurring-template-repository.port';
import { RecurringTemplateRecord } from '../recurring-template.types';

@Injectable()
export class GetRecurringTemplateUseCase {
  constructor(
    private readonly templateRepository: RecurringTemplateRepositoryPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(id: string, tenantId?: string): Promise<RecurringTemplateRecord> {
    tenantId = tenantId ?? this.requestContext.getTenantId();
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new NotFoundException('RecurringTemplate not found');
    }
    TenantScope.assertVisible(template.tenantId ?? null, tenantId);
    return template;
  }
}
