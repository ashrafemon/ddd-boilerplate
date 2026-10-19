import { Injectable } from '@nestjs/common';
import { GetPurchaseOrderUseCase } from '../usecases/get-purchase-order.usecase';
import { RegisterPurchaseOrderReceiptUseCase } from '../usecases/register-purchase-order-receipt.usecase';
import { HasPurchaseOrderReceiptsUseCase } from '../usecases/has-purchase-order-receipts.usecase';
import {
  PurchaseOrderForGrnPort,
  PurchaseOrderReference,
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '@business/procurement/purchase-order/public';

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
