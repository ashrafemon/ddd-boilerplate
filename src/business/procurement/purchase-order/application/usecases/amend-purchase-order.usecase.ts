import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderPricingService } from '../../domain/services/purchase-order-pricing.service';
import { AmendPurchaseOrderRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderPublisherPort } from '../../integrations/publishes/publishers/purchase-order.publisher-port';

// Controlled amendment of an issued PO (spec §4, PO-06).
@Injectable()
export class AmendPurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly integrationEvent: PurchaseOrderPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
  ) {}

  @Transactional()
  async execute(request: AmendPurchaseOrderRequest): Promise<string> {
    const actorId = request.actorId ?? this.requestContext.getUserId();
    const purchaseOrder = await this.purchaseOrderRepository.findById(request.id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    const applied = purchaseOrder.amend({
      expectedDeliveryDate: request.expectedDeliveryDate,
      lineUnitPrices: PurchaseOrderPricingService.toLineUnitPrices(
        request.lineUnitPrices,
        purchaseOrder.currency,
      ),
      reason: request.reason,
      actorId,
    });

    await this.purchaseOrderRepository.update(purchaseOrder);

    // The trail: who amended, when, which fields changed and why.
    await this.audit.record({
      action: 'purchase-order.amend',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrder.id.toString(),
      actorId,
      tenantId: this.requestContext.getTenantId(),
      companyId: this.requestContext.getCompanyId(),
      changes: { ...applied, reason: request.reason },
    });

    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id.toString();
  }
}
