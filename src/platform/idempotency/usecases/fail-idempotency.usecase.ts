import { Injectable, Logger } from '@nestjs/common';
import { IdempotencyRepositoryPort } from '../ports/idempotency-repository.port';
import { IdempotencyFailRequest } from '../idempotency.types';

/**
 * Use case: mark an idempotency key as FAILED.
 *
 * CAS update: IN_PROGRESS → FAILED with claim token + version.
 * A FAILED key can be re-acquired by a subsequent reserve.
 */
@Injectable()
export class FailIdempotencyUseCase {
  private readonly logger = new Logger(FailIdempotencyUseCase.name);

  constructor(private readonly repository: IdempotencyRepositoryPort) {}

  async execute(request: IdempotencyFailRequest): Promise<void> {
    const { reservation, errorCode, errorMessage } = request;

    const success = await this.repository.fail(
      reservation.id,
      reservation.claimToken,
      reservation.version,
      errorCode,
      errorMessage,
    );

    if (!success) {
      this.logger.warn(
        `Idempotency fail failed — ownership lost for reservation ${reservation.id}`,
      );
    }
  }
}
