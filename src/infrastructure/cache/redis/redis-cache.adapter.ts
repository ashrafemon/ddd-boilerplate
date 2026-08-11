import { Injectable, OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigurationService } from '../../../config/configuration.service';
import { InfrastructureException } from '../../../shared-kernel/exceptions/infrastructure.exception';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';
import { CachePort } from '../../../shared-kernel/ports/cache/cache.port';

/**
 * Redis-backed cache adapter.
 */
@Injectable()
export class RedisCacheAdapter implements CachePort, OnModuleDestroy, OnApplicationShutdown {
  private readonly client: Redis;

  constructor(
    private readonly configuration: ConfigurationService,
    private readonly logger: LoggerPort,
  ) {
    const settings = configuration.getRedis();
    this.client = new Redis({
      host: settings.host,
      port: settings.port,
      password: settings.password || undefined,
      db: settings.db,
      lazyConnect: false,
      maxRetriesPerRequest: 2,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error('redis-client-error', { message: error.message });
    });

    this.client.on('connect', () => {
      this.logger.info('redis-connected', { host: settings.host, port: settings.port });
    });
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      throw new InfrastructureException('Redis get failed', { key, cause: messageOf(error) });
    }
  }

  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        await this.client.set(key, raw, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, raw);
      }
    } catch (error) {
      throw new InfrastructureException('Redis set failed', { key, cause: messageOf(error) });
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      throw new InfrastructureException('Redis delete failed', { key, cause: messageOf(error) });
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(key)) > 0;
    } catch (error) {
      throw new InfrastructureException('Redis exists failed', { key, cause: messageOf(error) });
    }
  }

  public async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.close();
  }

  private async close(): Promise<void> {
    try {
      if (this.client.status === 'ready' || this.client.status === 'connecting') {
        await this.client.quit();
      }
    } catch {
      this.client.disconnect();
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
