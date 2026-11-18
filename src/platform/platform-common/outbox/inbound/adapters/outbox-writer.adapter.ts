import { Injectable } from '@nestjs/common';
import { AppendOutboxOptions, OutboxWriterPort } from '../ports/outbox-writer.port';
import { OutboxEvent } from '../../types/outbox.types';
import { AppendOutboxEventUseCase } from '../../use-cases/append-outbox-event.usecase';

/**
 * Inbound adapter implementing the single public `OutboxWriterPort`.
 *
 * Business and platform use cases inject the port and call `append(...)` inside
 * their `@Transactional()` scope; this adapter delegates to the use case and
 * holds no rules of its own.
 */
@Injectable()
export class OutboxWriterAdapter implements OutboxWriterPort {
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
