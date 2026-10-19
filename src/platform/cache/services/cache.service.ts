import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { CachePort } from '../ports/cache.port';
import { CacheGetResult, CacheKey } from '../cache.types';
import { GetCacheValueUseCase } from '../usecases/get-cache-value.usecase';
import { SetCacheValueUseCase } from '../usecases/set-cache-value.usecase';
import { DeleteCacheValueUseCase } from '../usecases/delete-cache-value.usecase';

/**
 * Cache service (design `common/01-cache`).
 *
 * `buildKey` lives here; get/set/delete delegate to one use case each.
 * This class implements the public CachePort.
 */
@Injectable()
export class CacheService implements CachePort {
  constructor(
    private readonly getValue: GetCacheValueUseCase,
    private readonly setValue: SetCacheValueUseCase,
    private readonly deleteValue: DeleteCacheValueUseCase,
    private readonly configService: ConfigService,
  ) {}

  buildKey(identity: CacheKey): string {
    const { keyPrefix, keyVersion } = this.configService.getCache();
    return [
      keyPrefix,
      keyVersion,
      identity.tenantId ?? 'platform',
      identity.organizationId ?? 'platform',
      identity.namespace,
      identity.resource,
      identity.variant ?? 'default',
    ].join(':');
  }

  get<T>(cacheKey: string): Promise<CacheGetResult<T>> {
    return this.getValue.execute<T>(cacheKey);
  }

  set<T>(cacheKey: string, value: T, ttlMs?: number): Promise<void> {
    return this.setValue.execute<T>(cacheKey, value, ttlMs);
  }

  delete(cacheKey: string): Promise<void> {
    return this.deleteValue.execute(cacheKey);
  }
}
