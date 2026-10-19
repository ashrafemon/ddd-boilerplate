import { Injectable, Logger } from '@nestjs/common';
import { PrismaIdempotencyRepository } from '../repositories/prisma-idempotency.repository';
import { RedisIdempotencyCacheAdapter } from '../adapters/redis-idempotency-cache.adapter';
import { IdempotencyFailRequest } from '../idempotency.types';

/**
 * Use case: release an idempotency claim (design `common/02-idempotency`).
 *
 * CAS-deletes the IN_PROGRESS row and evicts the Redis result key, so the next
 * call starts clean. No parking lot — crashed claims are taken over after the
 * claim lease expires.
 */
@Injectable()
export class FailIdempotencyUseCase {
  private readonly logger = new Logger(FailIdempotencyUseCase.name);

  constructor(
    private readonly repository: PrismaIdempotencyRepository,
    private readonly cache: RedisIdempotencyCacheAdapter,
  ) {}

  async execute(request: IdempotencyFailRequest): Promise<void> {
    const { reservation } = request;

    const deleted = await this.repository.failDeleteCas(reservation);
    if (!deleted) {
      this.logger.warn(
        `Idempotency fail skipped — ownership lost for reservation ${reservation.id}`,
      );
      return;
    }

    await this.cache.delete(this.cache.buildKey(reservation));
  }
}
