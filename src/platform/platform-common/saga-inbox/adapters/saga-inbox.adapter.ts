import { Injectable } from '@nestjs/common';
import { SagaInboxPort } from '../ports/saga-inbox.port';
import { SagaInboxRecord } from '../types/saga-inbox.types';
import { InsertInboxInput } from '../repositories/prisma-saga-inbox.repository';
import { BufferSagaInboxEventUseCase } from '../use-cases/buffer-saga-inbox-event.usecase';
import { IgnoreBufferedSagaEventsUseCase } from '../use-cases/ignore-buffered-saga-events.usecase';
import { ListBufferedSagaEventsUseCase } from '../use-cases/list-buffered-saga-events.usecase';
import { MarkSagaEventConsumedUseCase } from '../use-cases/mark-saga-event-consumed.usecase';

/**
 * Inbound adapter implementing `SagaInboxPort`.
 *
 * It only delegates to the use cases — no rules live here, which is why the saga
 * runtime can depend on the port and never on the ledger.
 */
@Injectable()
export class SagaInboxAdapter implements SagaInboxPort {
  constructor(
    private readonly bufferEvent: BufferSagaInboxEventUseCase,
    private readonly listBufferedEvents: ListBufferedSagaEventsUseCase,
    private readonly markEventConsumed: MarkSagaEventConsumedUseCase,
    private readonly ignoreBufferedEvents: IgnoreBufferedSagaEventsUseCase,
  ) {}

  async buffer(request: InsertInboxInput): Promise<boolean> {
    return this.bufferEvent.execute(request);
  }

  async listBuffered(
    instanceId: string,
    eventName: string,
    eventVersion: number,
    limit: number,
  ): Promise<SagaInboxRecord[]> {
    return this.listBufferedEvents.execute(instanceId, eventName, eventVersion, limit);
  }

  async markConsumed(id: string): Promise<boolean> {
    return this.markEventConsumed.execute(id);
  }

  async ignoreBuffered(
    instanceId: string,
    eventName: string,
    eventVersion: number,
    reason: string,
  ): Promise<number> {
    return this.ignoreBufferedEvents.execute(instanceId, eventName, eventVersion, reason);
  }
}
