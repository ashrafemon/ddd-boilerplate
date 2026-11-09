import { Injectable } from '@nestjs/common';
import { GetPurchaseOrderUseCase } from '../use-cases/get-purchase-order.usecase';
import { RegisterPurchaseOrderReceiptUseCase } from '../use-cases/register-purchase-order-receipt.usecase';
import { HasPurchaseOrderReceiptsUseCase } from '../use-cases/has-purchase-order-receipts.usecase';
import { PurchaseOrderForGrnPort } from '@business/procurement/purchase-order/public/ports/purchase-order-for-grn.port';
import { PurchaseOrderReference } from '@business/procurement/purchase-order/public/contracts/purchase-order-for-grn.contract';
import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '@business/procurement/purchase-order/public/contracts/purchase-order-receipt.contract';

/**
 * PurchaseOrder module's query facade exposed to GRN. Lives in the
 * PurchaseOrder module because it adapts the purchase order use case to the
 * consuming module's contract.
 */
@Injectable()
export class PurchaseOrderForGrnFacade extends PurchaseOrderForGrnPort {
  constructor(
    private readonly getPurchaseOrderUseCase: GetPurchaseOrderUseCase,
    private readonly registerReceiptUseCase: RegisterPurchaseOrderReceiptUseCase,
    private readonly hasReceiptsUseCase: HasPurchaseOrderReceiptsUseCase,
  ) {
    super();
  }

  getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null> {
    return this.getPurchaseOrderUseCase.execute(id);
  }

  registerReceipt(request: PurchaseOrderReceiptRequest): Promise<PurchaseOrderReceiptResult> {
    return this.registerReceiptUseCase.execute(request);
  }

  hasReceipts(purchaseOrderId: string): Promise<boolean> {
    return this.hasReceiptsUseCase.execute(purchaseOrderId);
  }
}
