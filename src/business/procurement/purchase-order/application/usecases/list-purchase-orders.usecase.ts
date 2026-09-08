import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { PurchaseOrderQuery } from '../../application/queries/purchase-order.query';
import { PurchaseOrderQueryRecord } from '../../domain/types/purchase-order.types';

@Injectable()
export class ListPurchaseOrdersUseCase {
  constructor(private readonly purchaseOrderQueryRepo: PurchaseOrderQuery) {}

  async execute(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>> {
    return this.purchaseOrderQueryRepo.findAll(query);
  }
}
