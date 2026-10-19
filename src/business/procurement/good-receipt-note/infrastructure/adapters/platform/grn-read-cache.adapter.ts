import { Injectable } from '@nestjs/common';
import { CachePort } from '@platform/cache/ports/cache.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { GrnReadCache } from '../../../application/outbound-ports/read-cache.port';
import { GrnQueryRecord } from '../../../domain/types/grn.types';

const NAMESPACE = 'grn';

/**
 * Platform-facing cache adapter (plan §1.6): keys ONLY through
 * `CachePort.buildKey` with the tenant/company identity from
 * `RequestContextPort` — never a hand-written key — and stores the query
 * record as disposable JSON with the platform default TTL. `get` MISS also
 * covers Redis down (platform contract), so failures degrade to the
 * authoritative query repository and never fail a request.
 */
@Injectable()
export class GrnReadCacheAdapter extends GrnReadCache {
  constructor(
    private readonly cache: CachePort,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  async getOrLoad(
    id: string,
    load: () => Promise<GrnQueryRecord | null>,
  ): Promise<GrnQueryRecord | null> {
    try {
      const cached = await this.cache.get<GrnQueryRecord | null>(this.buildKey(id));
      if (cached.status === 'HIT') {
        return revive(cached.value);
      }
    } catch {
      // Fail-open (cache README §6): a broken cache degrades to the DB.
    }

    const record = await load();
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
      // Fail-open: runs inside command transactions — a cache hiccup must
      // never roll back committed business state; the TTL bounds staleness.
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

/** JSON round-trip turns Date fields into ISO strings — revive them for DTOs. */
function revive(record: GrnQueryRecord | null): GrnQueryRecord | null {
  if (!record) return null;
  return {
    ...record,
    receivedAt: record.receivedAt ? new Date(record.receivedAt) : null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}
