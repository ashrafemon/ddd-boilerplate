import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ContextModule } from '@platform/context/context.module';
import { IdempotencyInterceptor } from './http/idempotency.interceptor';
import { IdempotencyReconciler } from './idempotency-reconciliation';
import { IdempotencyPort } from './ports/idempotency.port';
import { PrismaIdempotencyRepository } from './repositories/prisma-idempotency.repository';

/**
 * Platform idempotency module — the duplicate-suppression primitive.
 *
 * Two consumption shapes:
 *  1. HTTP: `@Idempotent()` decorator (globally installed interceptor, gated
 *     by the decorator) + required `Idempotency-Key` request header —
 *     reserves, runs once, replays the stored response.
 *  2. Programmatic: inject `IdempotencyPort` (reserve / markCompleted /
 *     markFailed) inside any use case or queued handler needing at-least-once
 *     input with exactly-once effect.
 */
@Module({
  imports: [ContextModule],
  providers: [
    PrismaIdempotencyRepository,
    { provide: IdempotencyPort, useExisting: PrismaIdempotencyRepository },
    IdempotencyReconciler,
    IdempotencyInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: IdempotencyInterceptor },
  ],
  exports: [IdempotencyPort],
})
export class IdempotencyModule {}
