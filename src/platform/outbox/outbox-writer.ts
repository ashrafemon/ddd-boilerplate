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
    const context = this.requestContext.get();
    const correlationId = context?.correlationId ?? event.correlationId;
    const requestId = context?.requestId;
    const tenantId = context?.tenantId;
    const organizationId = context?.organizationId;

    const message: IntegrationMessage = {
      eventType: event.constructor.name,
      aggregateType,
      aggregateId,
      payload: this.toPayload(event),
      headers: {
        'event-id': event.eventId,
        ...(requestId ? { 'request-id': requestId } : {}),
        ...(correlationId ? { 'correlation-id': correlationId } : {}),
        ...(event.causationId ? { 'causation-id': event.causationId } : {}),
        ...(tenantId ? { 'tenant-id': tenantId } : {}),
        ...(organizationId ? { 'organization-id': organizationId } : {}),
        ...event.headers,
      },
      occurredAt: event.occurredAt,
      correlationId,
      causationId: event.causationId,
      tenantId,
    };

    await this.outboxRepository.save(message);
  }

  private toPayload(event: DomainEvent): Record<string, unknown> {
    const { eventId, version, correlationId, causationId, occurredAt, headers, ...rest } =
      PrismaJson.snapshot(event);
    void eventId;
    void version;
    void correlationId;
    void causationId;
    void occurredAt;
    void headers;
    return { ...rest, occurredAt: event.occurredAt.toISOString() };
  }
}
