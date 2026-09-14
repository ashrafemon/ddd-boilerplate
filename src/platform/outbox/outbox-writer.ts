import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { Injectable } from '@nestjs/common';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { IntegrationMessage } from '@platform/messaging/ports/message-publisher.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { OutboxWriterPort } from './ports/outbox-writer.port';
import { OutboxRepository } from './ports/outbox-repository.port';

@Injectable()
export class OutboxWriter implements OutboxWriterPort {
  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly requestContext: RequestContextPort,
  ) {}

  async append(event: DomainEvent, aggregateType: string, aggregateId: string): Promise<void> {
    const correlationId = this.requestContext.getCorrelationId() ?? event.correlationId;
    const requestId = this.requestContext.getRequestId();

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
    const { eventId, version, correlationId, causationId, headers, ...rest } =
      PrismaJson.snapshot(event);
    void eventId;
    void version;
    void correlationId;
    void causationId;
    void headers;
    return { ...rest, occurredAt: event.occurredAt.toISOString() };
  }
}
