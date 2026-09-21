import { Injectable, Logger } from '@nestjs/common';
import { OutboxRepositoryPort } from '../ports/outbox-repository.port';

/**
 * Use case: record a delivery failure and schedule the next retry.
 *
 * CAS update: CLAIMED → FAILED (or DEAD_LETTER if attempts >= maxAttempts).
 * The `availableAt` timestamp drives the exponential backoff schedule.
 */
@Injectable()
export class MarkOutboxFailedUseCase {
  private readonly logger = new Logger(MarkOutboxFailedUseCase.name);

  constructor(private readonly repository: OutboxRepositoryPort) {}

  async execute(
    id: string,
    claimToken: string,
    error: string,
    availableAt: Date,
    maxAttempts: number,
  ): Promise<void> {
    try {
      await this.repository.markFailed(id, claimToken, error, availableAt, maxAttempts);
    } catch (err) {
      this.logger.warn(`Outbox markFailed failed for ${id} (claim lease will recover it): ${err}`);
    }
  }
}
