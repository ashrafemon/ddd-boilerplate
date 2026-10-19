import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { AuditPort } from '@platform/audit/ports/audit.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { ReadCachePort } from '../outbound-ports/read-cache.port';

export interface AmendPurchaseOrderRequest {
  id: string;
  expectedDeliveryDate?: Date;
  /** productId -> new unit price as a decimal amount (e.g. 12.50). */
  lineUnitPrices?: Record<string, number>;
  reason: string;
  actorId?: string;
}

/**
 * Controlled amendment of an ISSUED purchase order (spec §4
 * "AmendPurchaseOrder", PO-06).
 *
 * An issued order is not freely editable: the aggregate decides what may
 * change, the reason is mandatory, and the trail (who / when / why / which
 * fields) is written to the audit log inside the same transaction as the
 * order itself. The `PurchaseOrderAmended` event carries the changed fields
 * to downstream consumers.
 */
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
