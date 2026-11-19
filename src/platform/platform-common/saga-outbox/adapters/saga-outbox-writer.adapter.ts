import { Injectable } from '@nestjs/common';
import { SagaOutboxWriterPort } from '../ports/saga-outbox-writer.port';
import { AppendOutboxOptions } from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { OutboxEvent } from '@platform/platform-common/outbox/types/outbox.types';
import { AppendSagaOutboxEventUseCase } from '../use-cases/append-saga-outbox-event.usecase';

/**
 * Inbound adapter implementing the saga's public `SagaOutboxWriterPort`.
 *
 * Saga use cases inject the port and call `append(...)` inside their
 * `@Transactional()` scope; this adapter delegates to the use case and holds no
 * rules of its own.
 */
@Injectable()
export class SagaOutboxWriterAdapter implements SagaOutboxWriterPort {
  constructor(private readonly appendEvent: AppendSagaOutboxEventUseCase) {}

  async append(
    event: OutboxEvent,
    aggregateType: string,
    aggregateId: string,
    opts?: AppendOutboxOptions,
  ): Promise<void> {
    return this.appendEvent.execute(event, aggregateType, aggregateId, opts);
  }
}
