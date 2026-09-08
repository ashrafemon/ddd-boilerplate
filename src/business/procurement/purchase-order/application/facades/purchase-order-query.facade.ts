import { Injectable } from '@nestjs/common';
import { GetPurchaseOrderUseCase } from '../usecases/get-purchase-order.usecase';
import { PurchaseOrderQueryPort, PurchaseOrderReference } from '@business/procurement/purchase-order/public';

@Injectable()
export class PurchaseOrderQueryFacade extends PurchaseOrderQueryPort {
  constructor(private readonly getPurchaseOrderUseCase: GetPurchaseOrderUseCase) {
    super();
  }

  getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null> {
    return this.getPurchaseOrderUseCase.execute(id);
  }
}
