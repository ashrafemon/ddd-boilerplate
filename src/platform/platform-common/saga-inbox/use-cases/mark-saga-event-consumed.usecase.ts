import { Injectable } from '@nestjs/common';
import { SagaInboxRepositoryPort } from '../outbound/ports/saga-inbox.repository.port';

/**
 * Use case: mark one buffered event CONSUMED.
 *
 * Called after the WAIT step row exists (not before), so a crash between the two
 * leaves the event buffered and the step retries instead of losing the delivery.
 */
@Injectable()
export class MarkSagaEventConsumedUseCase {
  constructor(private readonly inbox: SagaInboxRepositoryPort) {}

  async execute(id: string): Promise<void> {
    await this.inbox.markConsumed(id);
  }
}
