import { Injectable } from '@nestjs/common';
import { GetPurchaseOrderUseCase } from '../usecases/get-purchase-order.usecase';
import {
  PurchaseOrderForGrnPort,
  PurchaseOrderReference,
} from '@business/procurement/purchase-order/public';

/**
 * PurchaseOrder module's query facade exposed to GRN. Lives in the
 * PurchaseOrder module because it adapts the purchase order use case to the
 * consuming module's contract.
 */
@Injectable()
export class PurchaseOrderForGrnFacade extends PurchaseOrderForGrnPort {
  constructor(private readonly getPurchaseOrderUseCase: GetPurchaseOrderUseCase) {
    super();
  }

  getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null> {
    return this.getPurchaseOrderUseCase.execute(id);
  }
}
