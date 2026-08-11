import { Injectable } from '@nestjs/common';
import { CachePort } from '../../shared-kernel/ports/cache/cache.port';

/**
 * No-op cache used when no cache transport is enabled. Keeps consumers
 * non-optional so application code does not branch on availability.
 */
@Injectable()
export class NullCacheAdapter implements CachePort {
  public async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  public async set<T>(_key: string, _value: T, _ttlSeconds?: number): Promise<void> {
    return;
  }

  public async delete(_key: string): Promise<void> {
    return;
  }

  public async exists(_key: string): Promise<boolean> {
    return false;
  }
}
