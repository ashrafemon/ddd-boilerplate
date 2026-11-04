import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { AuditPort } from '@platform/audit/ports/audit.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { AmendPurchaseOrderRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { ReadCachePort } from '../outbound-ports/read-cache.port';

// Controlled amendment of an issued PO (spec §4, PO-06).
@Injectable()
export class AmendPurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
    private readonly readCache: ReadCachePort,
  ) {}

  @Transactional()
  async execute(request: AmendPurchaseOrderRequest): Promise<PurchaseOrderId> {
    const actorId = request.actorId ?? this.requestContext.getUserId();
    const purchaseOrder = await this.purchaseOrderRepository.findById(
      PurchaseOrderId.fromString(request.id),
    );
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    const currency = purchaseOrder.currency;
    const lineUnitPrices = request.lineUnitPrices
      ? Object.fromEntries(
          Object.entries(request.lineUnitPrices).map(([productId, amount]) => [
            productId,
            // `Money.amount` is the decimal; `minorUnits` is the integer the
            // aggregate works in.
            Money.fromDecimal(amount, currency).minorUnits,
          ]),
        )
      : undefined;

    const applied = purchaseOrder.amend({
      expectedDeliveryDate: request.expectedDeliveryDate,
      lineUnitPrices,
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

    await this.readCache.invalidate(`purchase-order:${purchaseOrder.id.toString()}`);

    return purchaseOrder.id;
  }
}
