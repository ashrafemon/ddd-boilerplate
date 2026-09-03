import { Injectable } from '@nestjs/common';
import {
  PurchaseOrderQueryRepositoryPort,
} from '../../domain/ports/purchase-order-query-repository.port';
import { PurchaseOrderQueryRecord } from '../../domain/types/purchase-order.types';

@Injectable()
export class GetPurchaseOrderUseCase {
  constructor(private readonly purchaseOrderQueryRepo: PurchaseOrderQueryRepositoryPort) {}

  async execute(id: string): Promise<PurchaseOrderQueryRecord | null> {
    return this.purchaseOrderQueryRepo.findById(id);
  }
}
