import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type CacheConfig = { url: string };

@Injectable()
export class RedisAdapter extends Redis implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisAdapter.name);

  constructor(config: ConfigService) {
    const redisConfig = config.getOrThrow<CacheConfig>('cache.redis', {
      url: '',
    });

    super(redisConfig.url, {
      retryStrategy: times => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleInit() {
    this.logger.log('Redis connection start');
    try {
      await this.ping();
      this.logger.log('Redis connection success');
    } catch (err) {
      this.logger.log('Redis connection failed');
    }
  }

  async onModuleDestroy() {
    this.logger.log('Redis connection disconnect start');
    try {
      await this.quit();
      this.logger.log('Redis connection disconnect success');
    } catch (err) {
      this.logger.log('Redis connection disconnect failed');
    }
  }
}
