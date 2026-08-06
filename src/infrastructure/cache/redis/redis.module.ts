import { Module } from '@nestjs/common';
import { RedisAdapter } from './redis.adapter';

@Module({
  providers: [RedisAdapter],
  exports: [RedisAdapter],
})
export class RedisModule {}
