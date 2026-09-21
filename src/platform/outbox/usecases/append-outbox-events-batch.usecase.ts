import { Injectable } from '@nestjs/common';
import { OutboxRepositoryPort } from '../ports/outbox-repository.port';
import { AppendOutboxEventRequest, OutboxMessage } from '../outbox.types';

/**
 * Use case: append a batch of events to the transactional outbox.
 *
 * The batch is persisted atomically inside the caller's transaction.
 */
@Injectable()
export class AppendOutboxEventsBatchUseCase {
  constructor(private readonly repository: OutboxRepositoryPort) {}

  async execute(requests: AppendOutboxEventRequest[]): Promise<OutboxMessage[]> {
    return this.repository.appendMany(requests);
  }
}
