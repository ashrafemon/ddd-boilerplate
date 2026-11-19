import { Injectable } from '@nestjs/common';
import { PrismaSagaInboxRepository } from '../repositories/prisma-saga-inbox.repository';

/**
 * Use case: mark one buffered event CONSUMED.
 *
 * Called after the WAIT step row exists (not before), so a crash between the two
 * leaves the event buffered and the step retries instead of losing the delivery.
 * The write is a compare-and-set on `BUFFERED`: when two workers picked up the
 * same row, exactly one gets `true` and the loser knows its match was redundant.
 */
@Injectable()
export class MarkSagaEventConsumedUseCase {
  constructor(private readonly inbox: PrismaSagaInboxRepository) {}

  async execute(id: string): Promise<boolean> {
    return this.inbox.markConsumed(id);
  }
}
