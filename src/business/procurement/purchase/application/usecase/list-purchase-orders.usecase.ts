import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  PurchaseOrderQueryRepositoryPort,
  PurchaseOrderQueryRecord,
} from '../../domain/ports';

@Injectable()
export class ListPurchaseOrdersUseCase {
  constructor(private readonly purchaseOrderQueryRepo: PurchaseOrderQueryRepositoryPort) {}

  async execute(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>> {
    return this.purchaseOrderQueryRepo.findAll(query);
  }
}
