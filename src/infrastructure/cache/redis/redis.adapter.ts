import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisAdapter extends Redis implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      host: config.get<string>('redis.host', 'localhost'),
      port: config.get<number>('redis.port', 6379),
      password: config.get<string>('redis.password', ''),
      retryStrategy: times => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleInit() {
    await this.ping();
  }

  async onModuleDestroy() {
    await this.quit();
  }
}
