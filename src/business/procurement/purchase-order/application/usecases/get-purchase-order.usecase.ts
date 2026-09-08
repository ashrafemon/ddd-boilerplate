import { Injectable } from '@nestjs/common';
import { PurchaseOrderQuery } from '../../application/queries/purchase-order.query';
import { PurchaseOrderQueryRecord } from '../../domain/types/purchase-order.types';

@Injectable()
export class GetPurchaseOrderUseCase {
  constructor(private readonly purchaseOrderQueryRepo: PurchaseOrderQuery) {}

  async execute(id: string): Promise<PurchaseOrderQueryRecord | null> {
    return this.purchaseOrderQueryRepo.findById(id);
  }
}
