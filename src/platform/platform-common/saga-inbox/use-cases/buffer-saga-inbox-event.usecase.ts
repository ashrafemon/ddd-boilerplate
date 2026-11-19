import { Injectable } from '@nestjs/common';
import {
  PrismaSagaInboxRepository,
  InsertInboxInput,
} from '../repositories/prisma-saga-inbox.repository';

/**
 * Use case: record one delivered saga event as BUFFERED.
 *
 * The insert is the dedupe: the unique `(tenant, company, consumer, message)`
 * makes a redelivery a no-op, which is what keeps a saga from advancing twice
 * on the same event. Returns `false` when the delivery was already recorded.
 */
@Injectable()
export class BufferSagaInboxEventUseCase {
  constructor(private readonly inbox: PrismaSagaInboxRepository) {}

  async execute(input: InsertInboxInput): Promise<boolean> {
    const inserted = await this.inbox.tryInsert(input);
    if (!inserted) {
      return false;
    }
    await this.inbox.markBuffered(inserted.id, input.correlationKey, input.instanceId);
    return true;
  }
}
