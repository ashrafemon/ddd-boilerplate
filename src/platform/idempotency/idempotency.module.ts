import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { CacheModule as InfraCacheModule } from '@infrastructure/cache/cache.module';
import { ContextModule } from '@platform/context/context.module';
import { IdempotencyInterceptor } from './http/idempotency.interceptor';
import { IdempotencyReconciliation } from './idempotency.reconciliation';
import { IdempotencyPort } from './ports/idempotency.port';
import { PrismaIdempotencyRepository } from './repositories/prisma-idempotency.repository';
import { RedisIdempotencyCacheAdapter } from './adapters/redis-idempotency-cache.adapter';
import { ReserveIdempotencyUseCase } from './usecases/reserve-idempotency.usecase';
import { CompleteIdempotencyUseCase } from './usecases/complete-idempotency.usecase';
import { FailIdempotencyUseCase } from './usecases/fail-idempotency.usecase';
import { IdempotencyService } from './services/idempotency.service';

/**
 * Platform idempotency module — the duplicate-suppression primitive
 * (design `common/02-idempotency`). Postgres owns the claims; Redis caches
 * COMPLETED results for fast replay.
 *
 * Two consumption shapes:
 *  1. HTTP: `@Idempotent()` decorator (globally installed interceptor, gated
 *     by the decorator) + required `Idempotency-Key` request header.
 *  2. Programmatic: inject `IdempotencyPort` inside any use case or queued
 *     handler needing at-least-once input with exactly-once effect.
 */
@Module({
  imports: [ContextModule, PrismaModule, InfraCacheModule.forRoot()],
  providers: [
    // Concrete repository — injected directly into the use cases (no port).
    PrismaIdempotencyRepository,

    // Redis result cache adapter
    RedisIdempotencyCacheAdapter,

    // Use cases — one per file
    ReserveIdempotencyUseCase,
    CompleteIdempotencyUseCase,
    FailIdempotencyUseCase,

    // Facade → public port
    IdempotencyService,
    { provide: IdempotencyPort, useExisting: IdempotencyService },

    // Reconciliation (hourly purge)
    IdempotencyReconciliation,

    // HTTP interceptor
    IdempotencyInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: IdempotencyInterceptor },
  ],
  exports: [IdempotencyPort],
})
export class IdempotencyModule {}
