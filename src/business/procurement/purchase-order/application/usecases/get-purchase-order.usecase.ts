import { Injectable } from '@nestjs/common';
import { PurchaseOrderQuery } from '../../application/queries/purchase-order.query';
import { PurchaseOrderQueryRecord } from '../../domain/types/purchase-order.types';
import { ReadCachePort } from '../outbound-ports/read-cache.port';

/**
 * Read a single purchase order.
 *
 * Cached under `purchase-order:<id>`; the command use cases that mutate the
 * order invalidate that key after a successful write, so a cached entry can
 * never outlive the state it describes.
 */
@Injectable()
export class GetPurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderQueryRepo: PurchaseOrderQuery,
    private readonly readCache: ReadCachePort,
  ) {}

  async execute(id: string): Promise<PurchaseOrderQueryRecord | null> {
    return this.readCache.getOrLoad(`purchase-order:${id}`, () =>
      this.purchaseOrderQueryRepo.findById(id),
    );
  }
}
