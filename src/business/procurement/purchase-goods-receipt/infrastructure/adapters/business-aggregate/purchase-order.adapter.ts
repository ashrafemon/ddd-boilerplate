import { Injectable } from '@nestjs/common';
import { PurchaseOrderPort } from '@business/procurement/purchase-goods-receipt/application/outbound-ports/purchase-order-query.port';
import { PurchaseOrderForGrnPort } from '@business/procurement/purchase-order/public/ports/purchase-order-for-grn.port';
import { PurchaseOrderReference } from '@business/procurement/purchase-order/public/contracts/purchase-order-for-grn.contract';
import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '@business/procurement/purchase-order/public/contracts/purchase-order-receipt.contract';

/**
 * Infrastructure adapter that implements GRN's PurchaseOrderPort
 * by delegating to PurchaseOrder module's public PurchaseOrderForGrnPort facade.
 */
@Injectable()
export class PurchaseOrderAdapter implements PurchaseOrderPort {
  constructor(private readonly purchaseOrderForGrnPort: PurchaseOrderForGrnPort) {}

  getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null> {
    return this.purchaseOrderForGrnPort.getPurchaseOrder(id);
  }

  registerReceipt(request: PurchaseOrderReceiptRequest): Promise<PurchaseOrderReceiptResult> {
    return this.purchaseOrderForGrnPort.registerReceipt(request);
  }

  hasReceipts(purchaseOrderId: string): Promise<boolean> {
    return this.purchaseOrderForGrnPort.hasReceipts(purchaseOrderId);
  }
}
