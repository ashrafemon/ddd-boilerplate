import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { OutboxRepositoryPort } from '../outbound/ports/outbox.repository.port';

/**
 * Use case: delete PUBLISHED outbox rows past the retention window.
 *
 * Runs hourly from `OutboxDispatcherService`. PUBLISHED rows are the only ones
 * ever deleted — PENDING retries and DEAD_LETTER poison messages stay for
 * operators.
 */
@Injectable()
export class PurgePublishedOutboxUseCase {
  constructor(
    private readonly repository: OutboxRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(): Promise<number> {
    const { cleanupOlderThanHours } = this.configService.getOutbox();
    return this.repository.deletePublishedOlderThan(cleanupOlderThanHours);
  }
}
