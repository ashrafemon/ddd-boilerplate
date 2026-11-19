import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderPublisherPort } from '../publishes/publishers/purchase-order.publisher-port';

@Injectable()
export class SubmitPurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly integrationEvent: PurchaseOrderPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(id: string, actorId?: string): Promise<string> {
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new NotFoundException('Company not found in request context');
    }

    await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: 'PurchaseOrder',
      action: 'submit',
    });

    const actor = actorId ?? this.requestContext.getUserId();
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    purchaseOrder.submit();

    await this.purchaseOrderRepository.update(purchaseOrder);

    await this.audit.record({
      action: 'purchase-order.submit',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrder.id.toString(),
      actorId: actor,
      tenantId: this.requestContext.getTenantId(),
      companyId: this.requestContext.getCompanyId(),
      changes: { status: purchaseOrder.status },
    });

    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id.toString();
  }
}
