import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { InfrastructureException } from '@common/application/exceptions/infrastructure.exception';
import { ConfigService } from '@config/config.service';

const PROBE_KEY = 'http-cache:boot-probe';

/**
 * Initialization + health for the HTTP response cache (`@nestjs/cache-manager`).
 *
 * Per infrastructure conventions this class only proves the store works at
 * boot and exposes its state; it performs no caching. The interceptor in
 * `src/common/http/interceptors/` owns the actual reads and writes.
 *
 * Fail-closed in production (an enabled cache that cannot hold a value is a
 * boot error); in development it degrades to disabled with a warning so local
 * runs need nothing.
 */
@Injectable()
export class CacheManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheManagerService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly configService: ConfigService,
  ) {}

  /** True when `HTTP_CACHE_ENABLED=true` — the interceptor stays inert otherwise. */
  get isEnabled(): boolean {
    return this.configService.getHttpCache().enabled;
  }

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled) {
      this.logger.warn('http-cache-disabled');
      return;
    }

    const healthy = await this.ping();
    if (healthy) return;

    const message = 'HTTP cache store cannot hold a value';
    if (this.configService.isProduction) {
      throw new InfrastructureException('http-cache-unavailable', { reason: message });
    }
    this.logger.warn('http-cache-unavailable', { reason: message });
  }

  /** Round-trips the probe key; used by the boot check and the health endpoint. */
  async ping(): Promise<boolean> {
    try {
      await this.cache.set(PROBE_KEY, 'ok', 5_000);
      return (await this.cache.get<string>(PROBE_KEY)) === 'ok';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.cache.disconnect();
    } catch {
      // a store that cannot disconnect must not block shutdown
    }
  }
}
