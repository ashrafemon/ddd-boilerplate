import { Injectable } from '@nestjs/common';
import { OutboxRepositoryPort } from '../ports/outbox-repository.port';
import { AppendOutboxEventRequest, OutboxMessage } from '../outbox.types';

/**
 * Use case: append a single event to the transactional outbox.
 *
 * Called by business/application use cases inside their `@Transactional()`
 * scope. The event is persisted in the same DB transaction as the aggregate
 * change.
 */
@Injectable()
export class AppendOutboxEventUseCase {
  constructor(private readonly repository: OutboxRepositoryPort) {}

  async execute(request: AppendOutboxEventRequest): Promise<OutboxMessage> {
    return this.repository.append(request);
  }
}
