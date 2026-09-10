import { ConfigService } from '@config/config.service';
import { InfrastructureException } from '@shared-kernel/exceptions/infrastructure.exception';
import { Injectable, Logger, OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const MAX_RETRY_ATTEMPTS = 60;

@Injectable()
export class RedisService implements OnModuleDestroy, OnApplicationShutdown {
  private readonly redis?: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(configService: ConfigService) {
    const config = configService.getRedis();

    if (!config.url) {
      this.logger.warn('redis-disabled-missing-url');
      return;
    }

    this.redis = new Redis(config.url, {
      retryStrategy: times => (times > MAX_RETRY_ATTEMPTS ? null : Math.min(times * 50, 2000)),
      maxRetriesPerRequest: 3,
      connectTimeout: 5_000,
    });

    this.redis.on('error', (error: Error) => {
      this.logger.error('redis-client-error', { message: error.message });
    });

    this.redis.on('connect', () => {
      this.logger.log('redis-connected', { url: config.url });
    });
  }

  /** False when `REDIS_URL` is empty — the cache client is not connected. */
  get isEnabled(): boolean {
    return this.redis !== undefined;
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }

  private async close(): Promise<void> {
    if (!this.redis) return;

    try {
      const status = this.client.status;
      if (status === 'ready') {
        await this.client.quit();
      } else if (status === 'connecting' || status === 'reconnecting' || status === 'wait') {
        this.client.disconnect();
      }
    } catch {
      this.client.disconnect();
    }
  }

  public get client(): Redis {
    if (!this.redis) {
      throw new InfrastructureException('Redis is not configured: set REDIS_URL');
    }

    return this.redis;
  }
}
