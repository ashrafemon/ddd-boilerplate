import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnPublisherPort } from '../integrations/publishes/grn.publisher-port';

@Injectable()
export class CancelGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly integrationEvent: GrnPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
  ) {}

  @Transactional()
  async execute(id: string, actorId?: string): Promise<string> {
    const actor = actorId ?? this.requestContext.getUserId();
    const grn = await this.grnRepository.findById(id);
    if (!grn) {
      throw new NotFoundException('GRN not found');
    }

    grn.cancel(actor);

    await this.grnRepository.update(grn);

    await this.audit.record({
      action: 'grn.cancel',
      entityType: 'GoodReceiptNote',
      entityId: grn.id.toString(),
      actorId: actor,
      tenantId: this.requestContext.getTenantId(),
      companyId: this.requestContext.getCompanyId(),
      changes: { status: grn.status },
    });

    for (const event of grn.pullEvents()) {
      await this.integrationEvent.send(event, grn.id.toString());
    }

    return id;
  }
}
