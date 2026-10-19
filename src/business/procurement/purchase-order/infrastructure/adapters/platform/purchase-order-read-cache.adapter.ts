import { Injectable } from '@nestjs/common';
import { CachePort } from '@platform/cache/ports/cache.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { PurchaseOrderReadCache } from '../../../application/outbound-ports/read-cache.port';
import { PurchaseOrderQueryRecord } from '../../../domain/types/purchase-order.types';

const NAMESPACE = 'purchase-order';

/**
 * Platform-facing cache adapter (plan §1.6): keys ONLY through
 * `CachePort.buildKey` with the tenant/company identity from
 * `RequestContextPort` — never a hand-written key — and stores the query
 * record as disposable JSON with the platform default TTL. `get` MISS also
 * covers Redis down (platform contract), so failures degrade to the
 * authoritative query repository and never fail a request.
 */
@Injectable()
export class PurchaseOrderReadCacheAdapter extends PurchaseOrderReadCache {
  constructor(
    private readonly cache: CachePort,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  async getOrLoad(
    id: string,
    load: () => Promise<PurchaseOrderQueryRecord | null>,
  ): Promise<PurchaseOrderQueryRecord | null> {
    let record: PurchaseOrderQueryRecord | null = null;
    try {
      const cached = await this.cache.get<PurchaseOrderQueryRecord | null>(this.buildKey(id));
      if (cached.status === 'HIT') {
        return revive(cached.value);
      }
    } catch {
      // Fail-open (cache README §6): a broken cache degrades to the DB.
    }

    record = await load();
    try {
      await this.cache.set(this.buildKey(id), record);
    } catch {
      // Disposable write — never fail the request over it.
    }
    return record;
  }

  async invalidate(id: string): Promise<void> {
    try {
      await this.cache.delete(this.buildKey(id));
    } catch {
      // Fail-open: this runs inside command transactions — a cache hiccup
      // must never roll back committed business state. Worst case the stale
      // entry expires with its TTL.
    }
  }

  private buildKey(id: string): string {
    return this.cache.buildKey({
      tenantId: this.requestContext.getTenantId(),
      companyId: this.requestContext.getCompanyId(),
      namespace: NAMESPACE,
      resource: id,
    });
  }
}

/**
 * JSON round-trip turns Date fields into ISO strings; revive them so a cached
 * read is indistinguishable from the repository's (response DTOs parse
 * `z.date()`).
 */
function revive(record: PurchaseOrderQueryRecord | null): PurchaseOrderQueryRecord | null {
  if (!record) return null;
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    orderDate: record.orderDate ? new Date(record.orderDate) : null,
    expectedDeliveryDate: record.expectedDeliveryDate
      ? new Date(record.expectedDeliveryDate)
      : null,
  };
}
