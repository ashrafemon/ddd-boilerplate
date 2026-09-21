import { Injectable } from '@nestjs/common';
import { OutboxPort } from './ports/outbox.port';
import { AppendOutboxEventRequest, OutboxMessage } from './outbox.types';
import { AppendOutboxEventUseCase } from './usecases/append-outbox-event.usecase';
import { AppendOutboxEventsBatchUseCase } from './usecases/append-outbox-events-batch.usecase';

/**
 * Outbox service facade — the single entry point for all public outbox operations.
 *
 * Delegates to individual use cases (one per file) without containing
 * business rules itself. This class implements the public OutboxPort.
 *
 * Business modules consume only OutboxPort (aliased via this service).
 */
@Injectable()
export class OutboxService implements OutboxPort {
  constructor(
    private readonly appendEvent: AppendOutboxEventUseCase,
    private readonly appendEventsBatch: AppendOutboxEventsBatchUseCase,
  ) {}

  async append(request: AppendOutboxEventRequest): Promise<OutboxMessage> {
    return this.appendEvent.execute(request);
  }

  async appendMany(requests: AppendOutboxEventRequest[]): Promise<OutboxMessage[]> {
    return this.appendEventsBatch.execute(requests);
  }
}
