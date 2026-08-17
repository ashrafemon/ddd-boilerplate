import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { IntegrationMessage } from '@shared-kernel/ports/message-publisher.port';
import { OutboxWriterPort } from './ports/outbox-writer.port';
import { OutboxRepositoryPort } from './ports/outbox-repository.port';
import {
  REQUEST_ID_KEY,
  CORRELATION_ID_KEY,
} from '@shared-kernel/interceptors/request-id.interceptor';

/**
 * Writes domain events into the transactional outbox as integration messages.
 * Called by use cases inside a unit of work so the write is atomic with the
 * aggregate change.
 */
@Injectable()
export class OutboxWriter implements OutboxWriterPort {
  constructor(
    @Inject(OutboxRepositoryPort) private readonly outboxRepository: OutboxRepositoryPort,
    private readonly cls: ClsService,
  ) {}

  async append(event: DomainEvent, aggregateType: string, aggregateId: string): Promise<void> {
    const correlationId = this.cls.get<string>(CORRELATION_ID_KEY) ?? event.correlationId;
    const requestId = this.cls.get<string>(REQUEST_ID_KEY);

    const message: IntegrationMessage = {
      eventType: event.constructor.name,
      aggregateType,
      aggregateId,
      payload: this.toPayload(event),
      headers: {
        'event-id': event.eventId,
        ...(requestId ? { 'request-id': requestId } : {}),
        ...(correlationId ? { 'correlation-id': correlationId } : {}),
        ...event.headers,
      },
      occurredAt: event.occurredAt,
      correlationId,
      causationId: event.causationId,
    };

    await this.outboxRepository.save(message);
  }

  private toPayload(event: DomainEvent): Record<string, unknown> {
    const {
      eventId: _eventId,
      occurredAt: _occurredAt,
      version: _version,
      correlationId: _c,
      causationId: _c2,
      ...rest
    } = event as unknown as Record<string, unknown>;
    void _eventId;
    void _occurredAt;
    void _version;
    void _c;
    void _c2;
    return {
      ...rest,
      occurredAt: (event as unknown as { occurredAt: Date }).occurredAt.toISOString(),
    };
  }
}
