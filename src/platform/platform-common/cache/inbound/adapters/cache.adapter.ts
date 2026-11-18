import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { CachePort } from '../ports/cache.port';
import { CacheGetResult, CacheKey } from '../../types/cache.types';
import { GetCacheValueUseCase } from '../../use-cases/get-cache-value.usecase';
import { SetCacheValueUseCase } from '../../use-cases/set-cache-value.usecase';
import { DeleteCacheValueUseCase } from '../../use-cases/delete-cache-value.usecase';

/**
 * Inbound adapter implementing the public `CachePort` (design `common/01-cache`).
 *
 * Key building lives here; get/set/delete delegate to one use case each. The
 * module binds `{ provide: CachePort, useExisting: CacheAdapter }` so business
 * modules never see this class.
 */
@Injectable()
export class CacheAdapter implements CachePort {
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
      identity.companyId ?? 'platform',
      identity.namespace,
      identity.resource,
      identity.variant ?? 'default',
    ]
      .map(encodeURIComponent)
      .join(':');
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
