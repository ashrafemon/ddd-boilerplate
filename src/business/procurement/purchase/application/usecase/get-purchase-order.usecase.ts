import { Inject, Injectable } from '@nestjs/common';
import {
  PurchaseOrderQueryRepositoryPort,
  PurchaseOrderQueryRecord,
  PurchaseOrderQueryRepositoryPort,
} from '../../domain/ports';

@Injectable()
export class GetPurchaseOrderUseCase {
  constructor(
    @Inject(PurchaseOrderQueryRepositoryPort)
    private readonly purchaseOrderQueryRepo: PurchaseOrderQueryRepositoryPort,
  ) {}

  async execute(id: string): Promise<PurchaseOrderQueryRecord | null> {
    return this.purchaseOrderQueryRepo.findById(id);
  }
}
