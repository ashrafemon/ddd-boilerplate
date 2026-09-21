import { Module } from '@nestjs/common';
import { CacheModule as InfraCacheModule } from '@infrastructure/cache/cache.module';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { DistributedLockPort } from './ports/distributed-lock.port';
import { DistributedLockRepositoryPort } from './ports/distributed-lock-repository.port';
import { RedisLockPort } from './ports/redis-lock.port';
import { PrismaDistributedLockRepository } from './repositories/prisma-distributed-lock.repository';
import { RedisDistributedLockAdapter } from './adapters/redis-distributed-lock.adapter';
import { AcquireDistributedLockUseCase } from './usecases/acquire-distributed-lock.usecase';
import { RenewDistributedLockUseCase } from './usecases/renew-distributed-lock.usecase';
import { ReleaseDistributedLockUseCase } from './usecases/release-distributed-lock.usecase';
import { DistributedLockService } from './distributed-lock.service';
import { LockKeyBuilder } from './lock-key.builder';

/**
 * Platform distributed lock module — cross-instance mutual exclusion with
 * PostgreSQL fencing tokens and Redis lease ownership.
 *
 * Business modules inject DistributedLockPort and control the sequence:
 * acquire → execute → renew (optional) → release.
 */
@Module({
  imports: [InfraCacheModule.forRoot(), PrismaModule],
  providers: [
    // Repository — PostgreSQL fencing token sequence
    PrismaDistributedLockRepository,
    { provide: DistributedLockRepositoryPort, useExisting: PrismaDistributedLockRepository },

    // Redis adapter — atomic lock operations
    RedisDistributedLockAdapter,
    { provide: RedisLockPort, useExisting: RedisDistributedLockAdapter },

    // Key builder
    LockKeyBuilder,

    // Use cases — one per file
    AcquireDistributedLockUseCase,
    RenewDistributedLockUseCase,
    ReleaseDistributedLockUseCase,

    // Facade → public port
    DistributedLockService,
    { provide: DistributedLockPort, useExisting: DistributedLockService },
  ],
  exports: [DistributedLockPort],
})
export class LockingModule {}
