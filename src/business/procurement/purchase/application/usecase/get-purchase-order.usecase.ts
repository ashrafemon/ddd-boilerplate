import { Injectable } from '@nestjs/common';
import {
  PurchaseOrderQueryRepositoryPort,
  PurchaseOrderQueryRecord,
} from '../../domain/ports';

@Injectable()
export class GetPurchaseOrderUseCase {
  constructor(private readonly purchaseOrderQueryRepo: PurchaseOrderQueryRepositoryPort) {}

  async execute(id: string): Promise<PurchaseOrderQueryRecord | null> {
    return this.purchaseOrderQueryRepo.findById(id);
  }
}
