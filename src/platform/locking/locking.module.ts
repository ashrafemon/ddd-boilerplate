import { Module } from '@nestjs/common';
import { CacheModule as InfraCacheModule } from '@infrastructure/cache/cache.module';
import { RedisDistributedLockAdapter } from './adapters/redis-distributed-lock.adapter';
import { DistributedLockPort } from './ports/distributed-lock.port';

/**
 * Platform locking module — one owner-token Redis lock for every platform
 * service that must "do this work on exactly one instance right now".
 * Import this module and inject `DistributedLockPort`; do not talk to Redis
 * or write lock keys directly.
 */
@Module({
  imports: [InfraCacheModule.forRoot()],
  providers: [
    RedisDistributedLockAdapter,
    { provide: DistributedLockPort, useExisting: RedisDistributedLockAdapter },
  ],
  exports: [DistributedLockPort],
})
export class LockingModule {}
