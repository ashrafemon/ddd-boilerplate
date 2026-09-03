import { Injectable } from '@nestjs/common';
import { GetPurchaseOrderUseCase } from '../usecase';
import { PurchaseOrderQueryPort } from '../../public/ports/purchase-order.port';
import { PurchaseOrderReference } from '../../public/contracts/purchase-order.contracts';

@Injectable()
export class PurchaseOrderQueryFacade extends PurchaseOrderQueryPort {
  constructor(private readonly getPurchaseOrderUseCase: GetPurchaseOrderUseCase) {
    super();
  }

  getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null> {
    return this.getPurchaseOrderUseCase.execute(id);
  }
}