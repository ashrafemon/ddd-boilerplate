import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { PrismaOutboxRepository } from '../repositories/prisma-outbox.repository';
import { AppendOutboxOptions } from '../ports/outbox-writer.port';
import { DEFAULT_BROKER_TARGET, OutboxEvent } from '../outbox.types';

/**
 * Use case: append a single event to the transactional outbox.
 *
 * Called by business/platform use cases inside their `@Transactional()` scope,
 * so the event row commits atomically with the aggregate change. Nothing leaves
 * the process here — the scheduler publishes later.
 */
@Injectable()
export class AppendOutboxEventUseCase {
  constructor(
    private readonly repository: PrismaOutboxRepository,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(
    event: OutboxEvent,
    aggregateType: string,
    aggregateId: string,
    opts?: AppendOutboxOptions,
  ): Promise<void> {
    const context = this.requestContext.get();
    const broker = opts?.broker ?? DEFAULT_BROKER_TARGET;
    const correlationId = context?.correlationId ?? event.correlationId;
    const causationId = event.causationId;

    await this.repository.append({
      tenantId: context?.tenantId,
      companyId: context?.companyId,
      eventId: event.eventId,
      eventType: event.constructor.name,
      eventVersion: event.version ?? 1,
      aggregateType,
      aggregateId,
      payload: AppendOutboxEventUseCase.toPayload(event),
      occurredAt: event.occurredAt,
      correlationId,
      causationId,
      headers: {
        ...(event.headers ?? {}),
        'event-id': event.eventId,
        ...(correlationId ? { 'correlation-id': correlationId } : {}),
        ...(causationId ? { 'causation-id': causationId } : {}),
        ...(context?.tenantId ? { 'tenant-id': context.tenantId } : {}),
        ...(context?.companyId ? { 'company-id': context.companyId } : {}),
        broker,
      },
      broker,
      nextRetryAt: event.occurredAt,
    });
  }

  /** Strip the envelope fields — they are stored as dedicated columns. */
  private static toPayload(event: OutboxEvent): Record<string, unknown> {
    const { eventId, version, correlationId, causationId, occurredAt, headers, ...rest } =
      event as unknown as Record<string, unknown>;
    void eventId;
    void version;
    void correlationId;
    void causationId;
    void occurredAt;
    void headers;
    return { ...rest, occurredAt: event.occurredAt.toISOString() };
  }
}
