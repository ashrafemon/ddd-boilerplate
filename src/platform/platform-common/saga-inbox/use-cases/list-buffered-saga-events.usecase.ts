import { Injectable } from '@nestjs/common';
import { SagaInboxRecord } from '../types/saga-inbox.types';
import { SagaInboxRepositoryPort } from '../outbound/ports/saga-inbox.repository.port';

/**
 * Use case: read the BUFFERED events a WAIT step can consume, oldest first.
 *
 * Matching (`match`, `when`) belongs to the saga engine, so this returns the
 * candidate window and the caller decides which row actually satisfies the step.
 */
@Injectable()
export class ListBufferedSagaEventsUseCase {
  constructor(private readonly inbox: SagaInboxRepositoryPort) {}

  async execute(
    instanceId: string,
    eventName: string,
    eventVersion: number,
    limit: number,
  ): Promise<SagaInboxRecord[]> {
    return this.inbox.listBuffered(instanceId, eventName, eventVersion, limit);
  }
}
