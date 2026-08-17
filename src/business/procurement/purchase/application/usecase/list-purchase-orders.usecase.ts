import { Inject, Injectable } from '@nestjs/common';
import { QueryUseCase } from '@business/shared-business/application/use-case';
import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  PurchaseOrderQueryRepositoryPort,
  PurchaseOrderQueryRecord,
  PurchaseOrderQueryRepositoryPort,
} from '../../domain/ports';

@Injectable()
export class ListPurchaseOrdersUseCase implements QueryUseCase<
  PageQuery,
  PageResult<PurchaseOrderQueryRecord>
> {
  constructor(
    @Inject(PurchaseOrderQueryRepositoryPort)
    private readonly purchaseOrderQueryRepo: PurchaseOrderQueryRepositoryPort,
  ) {}

  async execute(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>> {
    return this.purchaseOrderQueryRepo.findAll(query);
  }
}
