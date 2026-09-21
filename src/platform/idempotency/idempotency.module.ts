import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { ContextModule } from '@platform/context/context.module';
import { IdempotencyInterceptor } from './http/idempotency.interceptor';
import { IdempotencyReconciler } from './idempotency-reconciliation';
import { IdempotencyPort } from './ports/idempotency.port';
import { IdempotencyRepositoryPort } from './ports/idempotency-repository.port';
import { PrismaIdempotencyRepository } from './repositories/prisma-idempotency.repository';
import { ReserveIdempotencyUseCase } from './usecases/reserve-idempotency.usecase';
import { CompleteIdempotencyUseCase } from './usecases/complete-idempotency.usecase';
import { FailIdempotencyUseCase } from './usecases/fail-idempotency.usecase';
import { IdempotencyService } from './idempotency.service';

/**
 * Platform idempotency module — the duplicate-suppression primitive.
 *
 * Two consumption shapes:
 *  1. HTTP: `@Idempotent()` decorator (globally installed interceptor, gated
 *     by the decorator) + required `Idempotency-Key` request header —
 *     reserves, runs once, replays the stored response.
 *  2. Programmatic: inject `IdempotencyPort` (reserve / complete /
 *     fail) inside any use case or queued handler needing at-least-once
 *     input with exactly-once effect.
 */
@Module({
  imports: [ContextModule, PrismaModule],
  providers: [
    // Repository — PostgreSQL idempotency metadata
    PrismaIdempotencyRepository,
    { provide: IdempotencyRepositoryPort, useExisting: PrismaIdempotencyRepository },

    // Use cases — one per file
    ReserveIdempotencyUseCase,
    CompleteIdempotencyUseCase,
    FailIdempotencyUseCase,

    // Facade → public port
    IdempotencyService,
    { provide: IdempotencyPort, useExisting: IdempotencyService },

    // Reconciliation
    IdempotencyReconciler,

    // HTTP interceptor
    IdempotencyInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: IdempotencyInterceptor },
  ],
  exports: [IdempotencyPort],
})
export class IdempotencyModule {}
