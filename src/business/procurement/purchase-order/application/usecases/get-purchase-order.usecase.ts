import { Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseOrderQuery } from '../../application/queries/purchase-order.query';
import { PurchaseOrderQueryRecord } from '../../domain/types/purchase-order.types';

/**
 * Read a single purchase order.
 *
 * Read-side caching is owned by the `@Cacheable()` controller decorator
 * (tenant-scoped, fail-open); this use case only reads the authoritative
 * repository inside the request's CLS transaction.
 */
@Injectable()
export class GetPurchaseOrderUseCase {
  constructor(private readonly purchaseOrderQueryRepo: PurchaseOrderQuery) {}

  async execute(id: string): Promise<PurchaseOrderQueryRecord> {
    const record = await this.purchaseOrderQueryRepo.findById(id);
    if (!record) {
      throw new NotFoundException('Purchase order not found');
    }
    return record;
  }
}
