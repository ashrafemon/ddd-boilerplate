import { Module } from '@nestjs/common';
import { CacheModule as InfraCacheModule } from '@infrastructure/cache/cache.module';
import { DistributedLockPort } from './ports/distributed-lock.port';
import { RedisLockPort } from './ports/redis-lock.port';
import { RedisDistributedLockAdapter } from './adapters/redis-distributed-lock.adapter';
import { AcquireDistributedLockUseCase } from './usecases/acquire-distributed-lock.usecase';
import { RenewDistributedLockUseCase } from './usecases/renew-distributed-lock.usecase';
import { ReleaseDistributedLockUseCase } from './usecases/release-distributed-lock.usecase';
import { LockingService } from './services/locking.service';
import { LockKeyBuilder } from './lock-key.builder';

/**
 * Platform distributed lock module — Redis-only cross-instance mutual
 * exclusion (design `common/03-lock`).
 *
 * No Prisma schema and no repository: ownership, lease TTL and the fencing
 * token sequence all live in Redis. Business modules inject DistributedLockPort
 * and control the sequence: acquire → execute → renew (optional) → release.
 */
@Module({
  imports: [InfraCacheModule.forRoot()],
  providers: [
    // Redis adapter — atomic lock operations (shared infra Redis client)
    RedisDistributedLockAdapter,
    { provide: RedisLockPort, useExisting: RedisDistributedLockAdapter },

    // Key builder
    LockKeyBuilder,

    // Use cases — one per file
    AcquireDistributedLockUseCase,
    RenewDistributedLockUseCase,
    ReleaseDistributedLockUseCase,

    // Facade → public port
    LockingService,
    { provide: DistributedLockPort, useExisting: LockingService },
  ],
  exports: [DistributedLockPort],
})
export class LockingModule {}
