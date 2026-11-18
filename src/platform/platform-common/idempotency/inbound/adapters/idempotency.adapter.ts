import { Injectable } from '@nestjs/common';
import { IdempotencyPort } from '../ports/idempotency.port';
import { ReserveIdempotencyUseCase } from '../../use-cases/reserve-idempotency.usecase';
import { CompleteIdempotencyUseCase } from '../../use-cases/complete-idempotency.usecase';
import { FailIdempotencyUseCase } from '../../use-cases/fail-idempotency.usecase';
import {
  IdempotencyCompleteRequest,
  IdempotencyFailRequest,
  IdempotencyReserveRequest,
  IdempotencyReserveResult,
} from '../../types/idempotency.types';

/**
 * Idempotency adapter — the single implementation of the inbound
 * `IdempotencyPort` (design `common/02-idempotency`). Delegates to one use
 * case per operation; it holds no rules of its own.
 *
 * Named *adapter*, not *service*: a class that exists to implement a port is an
 * adapter (docs/platform-standard.md §3).
 */
@Injectable()
export class IdempotencyAdapter implements IdempotencyPort {
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
