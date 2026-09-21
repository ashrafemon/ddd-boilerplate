import { Injectable, Logger } from '@nestjs/common';
import { CacheStoragePort } from '../ports/cache-storage.port';

/**
 * Use case: check whether a key exists and has not expired.
 */
@Injectable()
export class ExistsCacheValueUseCase {
  private readonly logger = new Logger(ExistsCacheValueUseCase.name);

  constructor(private readonly storage: CacheStoragePort) {}

  async execute(key: string): Promise<boolean> {
    try {
      return await this.storage.exists(key);
    } catch (error) {
      this.logger.warn('cache-exists-failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
