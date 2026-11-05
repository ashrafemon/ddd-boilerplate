import { Injectable } from '@nestjs/common';
import { AppendOutboxOptions, OutboxWriterPort } from '../ports/outbox-writer.port';
import { OutboxEvent } from '../outbox.types';
import { AppendOutboxEventUseCase } from '../usecases/append-outbox-event.usecase';

/**
 * Outbox service facade — implements the single public `OutboxWriterPort`.
 *
 * Business/platform callers inject `OutboxWriterPort` and call `append(...)`
 * inside their transaction; this service delegates to the use case and holds
 * no rules of its own.
 */
@Injectable()
export class OutboxService implements OutboxWriterPort {
  constructor(private readonly appendEvent: AppendOutboxEventUseCase) {}

  async append(
    event: OutboxEvent,
    aggregateType: string,
    aggregateId: string,
    opts?: AppendOutboxOptions,
  ): Promise<void> {
    return this.appendEvent.execute(event, aggregateType, aggregateId, opts);
  }
}
