import { Module } from '@nestjs/common';
import { INFRA_CACHE_MODULE } from '@infrastructure/cache/cache.module';
import { RedisDistributedLockAdapter } from './adapters/redis-distributed-lock.adapter';
import { DistributedLockPort } from './ports/distributed-lock.port';

/**
 * Platform locking module — one owner-token Redis lock for every platform
 * service that must "do this work on exactly one instance right now".
 * Import this module and inject `DistributedLockPort`; do not talk to Redis
 * or write lock keys directly.
 */
@Module({
  imports: [INFRA_CACHE_MODULE],
  providers: [
    RedisDistributedLockAdapter,
    { provide: DistributedLockPort, useExisting: RedisDistributedLockAdapter },
  ],
  exports: [DistributedLockPort],
})
export class LockingModule {}
