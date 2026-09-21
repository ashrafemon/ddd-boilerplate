import { Injectable } from '@nestjs/common';
import { OutboxEvent } from '@platform/events/bases/outbox-event.base';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { OutboxWriterPort } from './ports/outbox-writer.port';
import { OutboxPort } from './ports/outbox.port';

/**
 * Adapter that bridges the deprecated `OutboxWriterPort` positional-args
 * signature to the new `OutboxPort.append(request)` API.
 *
 * Existing business adapters that inject `OutboxWriterPort` and call
 * `append(event, aggregateType, aggregateId)` continue to work unchanged.
 *
 * @deprecated Inject `OutboxPort` directly in new code.
 */
@Injectable()
export class OutboxWriter implements OutboxWriterPort {
  constructor(
    private readonly outboxPort: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async append(event: OutboxEvent, aggregateType: string, aggregateId: string): Promise<void> {
    const context = this.requestContext.get();

    await this.outboxPort.append({
      tenantId: context?.tenantId,
      organizationId: context?.organizationId,
      eventType: event.constructor.name,
      eventVersion: (event as { version?: number }).version ?? 1,
      aggregateType,
      aggregateId,
      payload: this.toPayload(event),
      occurredAt: event.occurredAt,
      correlationId: context?.correlationId ?? event.correlationId,
      causationId: event.causationId,
      headers: {
        'event-id': event.eventId,
        ...(event.headers ?? {}),
      },
    });
  }

  private toPayload(event: OutboxEvent): Record<string, unknown> {
    // Strip envelope fields — they are stored as dedicated columns.
    const { eventId, version, correlationId, causationId, occurredAt, headers, ...rest } =
      event as unknown as Record<string, unknown>;
    void eventId;
    void version;
    void correlationId;
    void causationId;
    void occurredAt;
    void headers;
    return { ...(rest as Record<string, unknown>), occurredAt: event.occurredAt.toISOString() };
  }
}
