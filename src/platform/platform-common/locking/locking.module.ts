import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { RedisModule as InfraRedisModule } from '@infrastructure/redis/redis.module';
import { DistributedLockPort } from './inbound/ports/distributed-lock.port';
import { LockAdapter } from './inbound/adapters/lock.adapter';
import { LockLedgerPort } from './outbound/ports/lock-ledger.port';
import { LockLeasePort } from './outbound/ports/lock-lease.port';
import { PrismaLockLedgerRepository } from './outbound/adapters/prisma-lock-ledger.repository';
import { RedisLockLeaseAdapter } from './outbound/adapters/redis-lock-lease.adapter';
import { AcquireDistributedLockUseCase } from './use-cases/acquire-distributed-lock.usecase';
import { RenewDistributedLockUseCase } from './use-cases/renew-distributed-lock.usecase';
import { ReleaseDistributedLockUseCase } from './use-cases/release-distributed-lock.usecase';

/**
 * Platform distributed lock module — hybrid cross-instance mutual exclusion
 * (design `common/03-lock`).
 *
 * Redis holds the live lease (`SET NX PX` + Lua renew/release); PostgreSQL holds
 * the identity and the monotonic fencing token so a downstream resource can
 * reject a stale owner. `LOCK_DURABLE=false` drops the ledger for local runs.
 *
 * Business modules inject `DistributedLockPort` and own the sequence:
 * acquire → work → renew (long jobs) → release in a `finally`.
 */
@Module({
  imports: [InfraRedisModule, PrismaModule],
  providers: [
    // Outbound adapters → outbound ports
    RedisLockLeaseAdapter,
    { provide: LockLeasePort, useExisting: RedisLockLeaseAdapter },
    PrismaLockLedgerRepository,
    { provide: LockLedgerPort, useExisting: PrismaLockLedgerRepository },

    // Use cases — one per file
    AcquireDistributedLockUseCase,
    RenewDistributedLockUseCase,
    ReleaseDistributedLockUseCase,

    // Inbound port implementation → public port
    LockAdapter,
    { provide: DistributedLockPort, useExisting: LockAdapter },
  ],
  exports: [DistributedLockPort],
})
export class LockingModule {}
