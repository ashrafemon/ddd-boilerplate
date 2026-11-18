import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { RedisModule as InfraRedisModule } from '@infrastructure/redis/redis.module';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { IdempotencyInterceptor } from './http/idempotency.interceptor';
import { IdempotencyPort } from './inbound/ports/idempotency.port';
import { PrismaIdempotencyRepository } from './outbound/adapters/prisma-idempotency.repository';
import { RedisIdempotencyCacheAdapter } from './outbound/adapters/redis-idempotency-cache.adapter';
import { IdempotencyReplayCachePort } from './outbound/ports/idempotency-replay-cache.port';
import { IdempotencyRepositoryPort } from './outbound/ports/idempotency.repository.port';
import { IdempotencyReconciliationService } from './services/idempotency-reconciliation.service';
import { ReserveIdempotencyUseCase } from './use-cases/reserve-idempotency.usecase';
import { CompleteIdempotencyUseCase } from './use-cases/complete-idempotency.usecase';
import { FailIdempotencyUseCase } from './use-cases/fail-idempotency.usecase';
import { IdempotencyAdapter } from './inbound/adapters/idempotency.adapter';

/**
 * Platform idempotency module — the duplicate-suppression primitive
 * (design `common/02-idempotency`). Postgres owns the claims; Redis caches
 * COMPLETED results for fast replay.
 *
 * Layering: use cases depend on `IdempotencyRepositoryPort` and
 * `IdempotencyReplayCachePort`; the Prisma and Redis adapters implement them.
 *
 * Two consumption shapes:
 *  1. HTTP: `@Idempotent()` decorator (globally installed interceptor, gated
 *     by the decorator) + required `Idempotency-Key` request header.
 *  2. Programmatic: inject `IdempotencyPort` inside any use case or queued
 *     handler needing at-least-once input with exactly-once effect.
 */
@Module({
  imports: [ContextModule, PrismaModule, InfraRedisModule],
  providers: [
    // Outbound adapters → outbound ports (use cases depend on the ports)
    PrismaIdempotencyRepository,
    { provide: IdempotencyRepositoryPort, useExisting: PrismaIdempotencyRepository },
    RedisIdempotencyCacheAdapter,
    { provide: IdempotencyReplayCachePort, useExisting: RedisIdempotencyCacheAdapter },

    // Use cases — one per file
    ReserveIdempotencyUseCase,
    CompleteIdempotencyUseCase,
    FailIdempotencyUseCase,

    // Inbound port implementation → public port
    IdempotencyAdapter,
    { provide: IdempotencyPort, useExisting: IdempotencyAdapter },

    // Reconciliation service (hourly purge) — orchestration, implements no port
    IdempotencyReconciliationService,

    // HTTP interceptor
    IdempotencyInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: IdempotencyInterceptor },
  ],
  exports: [IdempotencyPort],
})
export class IdempotencyModule {}
