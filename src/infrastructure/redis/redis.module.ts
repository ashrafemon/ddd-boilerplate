import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Infrastructure Redis module — only client initialization/setup.
 *
 * Registers the Redis client (ioredis) used by caching, locking, idempotency
 * replay and rate limiting. Deliberately NOT `@Global()` — consumers import it
 * explicitly. No driver selection: Redis is the only cache store.
 */
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
