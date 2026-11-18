import { Injectable } from '@nestjs/common';
import { SagaInboxRepositoryPort } from '../outbound/ports/saga-inbox.repository.port';

/**
 * Use case: park the still-buffered events of one contract as IGNORED.
 *
 * A WAIT step that timed out and was skipped can no longer consume them, so the
 * ledger records the reason instead of leaving rows BUFFERED forever.
 */
@Injectable()
export class IgnoreBufferedSagaEventsUseCase {
  constructor(private readonly inbox: SagaInboxRepositoryPort) {}

  async execute(
    instanceId: string,
    eventName: string,
    eventVersion: number,
    reason: string,
  ): Promise<number> {
    return this.inbox.ignoreBuffered(instanceId, eventName, eventVersion, reason);
  }
}
