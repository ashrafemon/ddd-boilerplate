import { Injectable } from '@nestjs/common';
import { CachePort } from '@platform/cache/ports/cache.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { ReadCachePort } from '../../../application/outbound-ports/read-cache.port';

/**
 * Read-cache adapter for the good-receipt-note module.
 *
 * Wraps the platform `CachePort` and scopes every key to the current
 * tenant/company, so two tenants can never read each other's entry.
 *
 * Fail-open by construction: `CachePort.get` already returns MISS when Redis
 * is down or the cache is disabled, and the writes are swallowed — a cache
 * outage must never fail a business transaction.
 */
@Injectable()
export class ReadCacheAdapter implements ReadCachePort {
  constructor(
    private readonly cache: CachePort,
    private readonly context: RequestContextPort,
  ) {}

  async getOrLoad<T>(key: string, load: () => Promise<T>): Promise<T> {
    const cacheKey = this.buildKey(key);
    const hit = await this.cache.get<T>(cacheKey);
    if (hit.status === 'HIT') {
      return hit.value;
    }
    const value = await load();
    await this.cache.set(cacheKey, value).catch(() => undefined);
    return value;
  }

  async invalidate(key: string): Promise<void> {
    await this.cache.delete(this.buildKey(key)).catch(() => undefined);
  }

  private buildKey(key: string): string {
    return this.cache.buildKey({
      namespace: 'read',
      resource: key,
      tenantId: this.context.getTenantId(),
      companyId: this.context.getCompanyId(),
    });
  }
}
