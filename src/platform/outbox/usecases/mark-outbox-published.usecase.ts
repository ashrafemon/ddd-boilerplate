import { Injectable, Logger } from '@nestjs/common';
import { OutboxRepositoryPort } from '../ports/outbox-repository.port';

/**
 * Use case: mark an outbox message as PUBLISHED.
 *
 * CAS update: CLAIMED → PUBLISHED with claimToken validation.
 * Returns silently if ownership was lost (another worker took over).
 */
@Injectable()
export class MarkOutboxPublishedUseCase {
  private readonly logger = new Logger(MarkOutboxPublishedUseCase.name);

  constructor(private readonly repository: OutboxRepositoryPort) {}

  async execute(id: string, claimToken: string): Promise<void> {
    try {
      await this.repository.markPublished(id, claimToken);
    } catch (err) {
      this.logger.warn(
        `Outbox markPublished failed for ${id} (ownership may have been lost): ${err}`,
      );
    }
  }
}
