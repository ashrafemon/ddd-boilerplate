import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  PurchaseOrderQueryRepositoryPort,
} from '../../domain/ports/purchase-order-query-repository.port';
import { PurchaseOrderQueryRecord } from '../../domain/types/purchase-order.types';

@Injectable()
export class ListPurchaseOrdersUseCase {
  constructor(private readonly purchaseOrderQueryRepo: PurchaseOrderQueryRepositoryPort) {}

  async execute(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>> {
    return this.purchaseOrderQueryRepo.findAll(query);
  }
}
