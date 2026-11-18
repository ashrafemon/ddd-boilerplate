import { Injectable, Logger } from '@nestjs/common';
import { PrismaIdempotencyRepository } from '../repositories/prisma-idempotency.repository';
import { RedisIdempotencyCacheAdapter } from '../adapters/redis-idempotency-cache.adapter';
import { IdempotencyCompleteRequest } from '../idempotency.types';

/**
 * Use case: mark an idempotency claim COMPLETED and mirror the result to Redis.
 *
 * CAS on id + claimToken + version + IN_PROGRESS. If ownership was lost, the
 * operation is a no-op (the winner already stored the authoritative result).
 */
@Injectable()
export class CompleteIdempotencyUseCase {
  private readonly logger = new Logger(CompleteIdempotencyUseCase.name);

  constructor(
    private readonly repository: PrismaIdempotencyRepository,
    private readonly cache: RedisIdempotencyCacheAdapter,
  ) {}

  async execute(request: IdempotencyCompleteRequest): Promise<void> {
    const { reservation, result } = request;

    const completed = await this.repository.completeCas(reservation, result);
    if (!completed) {
      this.logger.warn(
        `Idempotency complete skipped — ownership lost for reservation ${reservation.id}`,
      );
      return;
    }

    const ttlMs = completed.expiresAt.getTime() - Date.now();
    if (ttlMs > 0) {
      await this.cache.set(this.cache.buildKey(reservation), result, ttlMs);
    }
  }
}
