import { Injectable, Logger } from '@nestjs/common';
import { IdempotencyRepositoryPort } from '../outbound/ports/idempotency.repository.port';
import { IdempotencyReplayCachePort } from '../outbound/ports/idempotency-replay-cache.port';
import { IdempotencyFailRequest } from '../types/idempotency.types';

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
    private readonly repository: IdempotencyRepositoryPort,
    private readonly cache: IdempotencyReplayCachePort,
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
