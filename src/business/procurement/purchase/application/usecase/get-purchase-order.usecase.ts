import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import {
  PurchaseOrderQueryRepositoryPort,
  PurchaseOrderQueryRecord,
  PurchaseOrderQueryRepositoryPort,
} from '../../domain/ports';

@Injectable()
export class GetPurchaseOrderUseCase implements QueryUseCase<
  string,
  PurchaseOrderQueryRecord | null
> {
  constructor(
    @Inject(PurchaseOrderQueryRepositoryPort)
    private readonly purchaseOrderQueryRepo: PurchaseOrderQueryRepositoryPort,
  ) {}

  async execute(id: string): Promise<PurchaseOrderQueryRecord | null> {
    return this.purchaseOrderQueryRepo.findById(id);
  }
}
