import { Injectable, Logger } from '@nestjs/common';
import { IdempotencyRepositoryPort } from '../ports/idempotency-repository.port';
import { IdempotencyCompleteRequest } from '../idempotency.types';

/**
 * Use case: mark an idempotency key as COMPLETED.
 *
 * CAS update: IN_PROGRESS → COMPLETED with claim token + version.
 * Returns silently if ownership lost (another worker took over).
 */
@Injectable()
export class CompleteIdempotencyUseCase {
  private readonly logger = new Logger(CompleteIdempotencyUseCase.name);

  constructor(private readonly repository: IdempotencyRepositoryPort) {}

  async execute(request: IdempotencyCompleteRequest): Promise<void> {
    const { reservation, result } = request;

    const success = await this.repository.complete(
      reservation.id,
      reservation.claimToken,
      reservation.version,
      result,
    );

    if (!success) {
      this.logger.warn(
        `Idempotency complete failed — ownership lost for reservation ${reservation.id}`,
      );
    }
  }
}
