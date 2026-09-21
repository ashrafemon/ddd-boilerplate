import { Injectable } from '@nestjs/common';
import { InboxRepositoryPort } from '../ports/inbox-repository.port';
import { InboxMessage, ClaimInboxOptions } from '../inbox.types';

/**
 * Use case: claim retryable FAILED messages for re-processing.
 *
 * Uses FOR UPDATE SKIP LOCKED to safely claim messages across multiple workers.
 */
@Injectable()
export class ClaimInboxRetryUseCase {
  constructor(private readonly repository: InboxRepositoryPort) {}

  async execute(options: ClaimInboxOptions): Promise<InboxMessage[]> {
    return this.repository.claimRetryable(options);
  }
}
