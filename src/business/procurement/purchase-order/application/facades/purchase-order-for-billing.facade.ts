import { Injectable } from '@nestjs/common';
import { GetPurchaseOrderUseCase } from '../use-cases/get-purchase-order.usecase';
import { PurchaseOrderForBillingPort } from '@business/procurement/purchase-order/public/ports/purchase-order-for-billing.port';
import { PurchaseOrderReference } from '@business/procurement/purchase-order/public/contracts/purchase-order-for-billing.contract';
import { BillingProgress } from '@business/procurement/purchase-order/public/contracts/purchase-order-for-billing.contract';

/**
 * PurchaseOrder module's billing facade exposed to Finance. Adapts purchase
 * order data to the billing contract used by the Finance module.
 */
@Injectable()
export class PurchaseOrderForBillingFacade extends PurchaseOrderForBillingPort {
  constructor(private readonly getPurchaseOrderUseCase: GetPurchaseOrderUseCase) {
    super();
  }

  async getPurchaseOrderForBilling(id: string): Promise<PurchaseOrderReference | null> {
    const po = await this.getPurchaseOrderUseCase.execute(id);
    if (!po) return null;
    return {
      id: po.id,
      poNo: po.orderNumber,
      vendorId: po.vendorId,
      status: po.status,
      totalAmount: po.total,
      currency: po.currency,
      companyId: '',
      tenantId: null,
    };
  }

  async getBillingProgress(purchaseOrderId: string): Promise<BillingProgress | null> {
    const po = await this.getPurchaseOrderUseCase.execute(purchaseOrderId);
    if (!po) return null;
    const orderedQuantity = po.lines.reduce((sum, line) => sum + line.quantity, 0);
    const receivedQuantity = po.lines.reduce((sum, line) => sum + line.receivedQuantity, 0);
    return {
      orderedQuantity,
      receivedQuantity,
      billedQuantity: 0,
      remainingQuantity: orderedQuantity,
    };
  }
}
