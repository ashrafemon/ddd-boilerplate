import { Injectable } from '@nestjs/common';
import { IdempotencyPort } from '../ports/idempotency.port';
import { ReserveIdempotencyUseCase } from '../usecases/reserve-idempotency.usecase';
import { CompleteIdempotencyUseCase } from '../usecases/complete-idempotency.usecase';
import { FailIdempotencyUseCase } from '../usecases/fail-idempotency.usecase';
import {
  IdempotencyCompleteRequest,
  IdempotencyFailRequest,
  IdempotencyReserveRequest,
  IdempotencyReserveResult,
} from '../idempotency.types';

/**
 * Idempotency service — the single public entry point (design
 * `common/02-idempotency`). Delegates to one use case per operation.
 */
@Injectable()
export class IdempotencyService implements IdempotencyPort {
  constructor(
    private readonly reserveUseCase: ReserveIdempotencyUseCase,
    private readonly completeUseCase: CompleteIdempotencyUseCase,
    private readonly failUseCase: FailIdempotencyUseCase,
  ) {}

  async reserve(request: IdempotencyReserveRequest): Promise<IdempotencyReserveResult> {
    return this.reserveUseCase.execute(request);
  }

  async complete(request: IdempotencyCompleteRequest): Promise<void> {
    return this.completeUseCase.execute(request);
  }

  async fail(request: IdempotencyFailRequest): Promise<void> {
    return this.failUseCase.execute(request);
  }
}
