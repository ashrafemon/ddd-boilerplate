import { Injectable } from '@nestjs/common';
import { CachePort } from './ports/cache.port';
import { CacheGetResult, CacheGetOrSetRequest } from './cache.types';
import { GetCacheValueUseCase } from './usecases/get-cache-value.usecase';
import { GetCacheValueWithResultUseCase } from './usecases/get-cache-value-with-result.usecase';
import { SetCacheValueUseCase } from './usecases/set-cache-value.usecase';
import { DeleteCacheValueUseCase } from './usecases/delete-cache-value.usecase';
import { ExistsCacheValueUseCase } from './usecases/exists-cache-value.usecase';
import { GetOrSetCacheValueUseCase } from './usecases/get-or-set-cache-value.usecase';

/**
 * Cache service facade — the single entry point for all cache operations.
 *
 * Delegates to individual use cases (one per file) without containing
 * business rules itself. This class implements the public CachePort.
 *
 * Failures are logged and wrapped — the caller falls back to the source
 * of truth. Cache write failures must never roll back database writes.
 */
@Injectable()
export class CacheService implements CachePort {
  constructor(
    private readonly getValue: GetCacheValueUseCase,
    private readonly getValueWithResult: GetCacheValueWithResultUseCase,
    private readonly setValue: SetCacheValueUseCase,
    private readonly deleteValue: DeleteCacheValueUseCase,
    private readonly existsValue: ExistsCacheValueUseCase,
    private readonly getOrSetValue: GetOrSetCacheValueUseCase,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    return this.getValue.execute<T>(key);
  }

  async getWithResult<T>(key: string): Promise<CacheGetResult<T>> {
    return this.getValueWithResult.execute<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    return this.setValue.execute<T>(key, value, ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    return this.deleteValue.execute(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.existsValue.execute(key);
  }

  async getOrSet<T>(request: CacheGetOrSetRequest<T>): Promise<T> {
    return this.getOrSetValue.execute<T>(request);
  }
}
