import { Injectable } from '@nestjs/common';
import { OutboxRepositoryPort } from '../ports/outbox-repository.port';
import { ClaimOutboxOptions, OutboxClaimedRecord } from '../outbox.types';

/**
 * Use case: claim a batch of available outbox messages for dispatch.
 *
 * Uses FOR UPDATE SKIP LOCKED to safely claim across multiple workers.
 * Stamps CLAIMED + claimToken and increments attempts.
 */
@Injectable()
export class ClaimOutboxMessagesUseCase {
  constructor(private readonly repository: OutboxRepositoryPort) {}

  async execute(options: ClaimOutboxOptions): Promise<OutboxClaimedRecord[]> {
    return this.repository.claimBatch(options);
  }
}
