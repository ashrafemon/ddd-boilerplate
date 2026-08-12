import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  PURCHASE_ORDER_QUERY_REPOSITORY,
  PurchaseOrderQueryRecord,
  PurchaseOrderQueryRepositoryPort,
} from '../../ports/outbound/purchase-order-query-repository.port';

@Injectable()
export class ListPurchaseOrdersUseCase implements QueryUseCase<
  PageQuery,
  PageResult<PurchaseOrderQueryRecord>
> {
  constructor(
    @Inject(PURCHASE_ORDER_QUERY_REPOSITORY)
    private readonly purchaseOrderQueryRepo: PurchaseOrderQueryRepositoryPort,
  ) {}

  async execute(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>> {
    return this.purchaseOrderQueryRepo.findAll(query);
  }
}
