import { Injectable } from '@nestjs/common';
import { PurchaseOrderPort } from '@business/procurement/good-receipt-note/application/outbound-ports/purchase-order-query.port';
import {
  PurchaseOrderForGrnPort,
  PurchaseOrderReference,
} from '@business/procurement/purchase-order/public';

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
}
