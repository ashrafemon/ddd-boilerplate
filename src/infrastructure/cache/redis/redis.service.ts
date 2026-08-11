import { ConfigService } from '@config/config.service';
import { Injectable, OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy, OnApplicationShutdown {
  private readonly redis: Redis;

  constructor(
    configService: ConfigService,
    private readonly logger: LoggerPort,
  ) {
    const config = configService.getRedis();
    this.redis = new Redis(config.url, {
      retryStrategy: times => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error: Error) => {
      this.logger.error('redis-client-error', { message: error.message });
    });

    this.redis.on('connect', () => {
      this.logger.info('redis-connected', { url: config.url });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async onApplicationShutdown(): Promise<void> {
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

  public get client(): Redis {
    return this.redis;
  }
}
