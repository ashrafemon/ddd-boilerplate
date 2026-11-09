import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnPublisherPort } from '../publishes/publishers/grn.publisher-port';
import { PurchaseOrderPort } from '../outbound-ports/purchase-order-query.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AuditPort } from '@platform/platform-common/audit/ports/audit.port';

@Injectable()
export class PostGrnUseCase {
  constructor(
    private readonly grnRepository: GrnCommandRepository,
    private readonly purchaseOrderPort: PurchaseOrderPort,
    private readonly integrationEvent: GrnPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
  ) {}

  @Transactional()
  async execute(input: { id: string; actorId?: string }): Promise<string> {
    const actorId = input.actorId ?? this.requestContext.getUserId();

    const grn = await this.grnRepository.findById(input.id);
    if (!grn) {
      throw new NotFoundException('GRN not found');
    }

    await this.purchaseOrderPort.registerReceipt({
      purchaseOrderId: grn.purchaseOrderId,
      lines: grn.lines.map(l => ({
        productId: l.productId,
        receivedQuantity: l.acceptedQuantity > 0 ? l.acceptedQuantity : l.receivedQuantity,
      })),
    });

    grn.complete(actorId);
    await this.grnRepository.update(grn);

    await this.audit.record({
      action: 'grn.post',
      entityType: 'GoodReceiptNote',
      entityId: grn.id.toString(),
      actorId,
      tenantId: this.requestContext.getTenantId(),
      companyId: this.requestContext.getCompanyId(),
      changes: { status: grn.status },
    });

    for (const event of grn.pullEvents()) {
      await this.integrationEvent.send(event, grn.id.toString());
    }

    return grn.id.toString();
  }
}
