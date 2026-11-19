import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';

/** The canonical wire body every transport carries (JSON-safe). */
export interface WireEnvelope {
  eventId: string;
  eventType: string;
  eventVersion: number;
  tenantId: string | null;
  companyId: string | null;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  occurredAt: string;
  correlationId: string | null;
  causationId: string | null;
}

/**
 * One serializer for all three brokers.
 *
 * Consumers cannot scope what they receive without `tenantId`/`companyId`, and
 * cannot dedupe or trace without `eventId`/`eventVersion`/`correlationId` — a
 * publisher that trims the envelope silently breaks every cross-process
 * listener, which is exactly what happened when RabbitMQ, Kafka and SQS each
 * built their own partial body.
 */
export function toWireEnvelope(envelope: OutboxEnvelope): WireEnvelope {
  return {
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    eventVersion: envelope.eventVersion ?? 1,
    tenantId: envelope.tenantId ?? null,
    companyId: envelope.companyId ?? null,
    aggregateType: envelope.aggregateType,
    aggregateId: envelope.aggregateId,
    payload: envelope.payload,
    headers: envelope.headers ?? {},
    occurredAt: envelope.occurredAt.toISOString(),
    correlationId: envelope.correlationId ?? null,
    causationId: envelope.causationId ?? null,
  };
}

/** Inverse: a delivered body back into the platform's canonical envelope. */
export function fromWireEnvelope(value: unknown): OutboxEnvelope | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.eventId !== 'string' ||
    typeof candidate.eventType !== 'string' ||
    typeof candidate.aggregateType !== 'string' ||
    typeof candidate.aggregateId !== 'string' ||
    typeof candidate.payload !== 'object' ||
    candidate.payload === null
  ) {
    return null;
  }

  const occurredAt =
    typeof candidate.occurredAt === 'string' || candidate.occurredAt instanceof Date
      ? new Date(candidate.occurredAt)
      : new Date();

  return {
    eventId: candidate.eventId,
    eventType: candidate.eventType,
    eventVersion: typeof candidate.eventVersion === 'number' ? candidate.eventVersion : 1,
    tenantId: typeof candidate.tenantId === 'string' ? candidate.tenantId : null,
    companyId: typeof candidate.companyId === 'string' ? candidate.companyId : null,
    aggregateType: candidate.aggregateType,
    aggregateId: candidate.aggregateId,
    payload: candidate.payload as Record<string, unknown>,
    headers:
      typeof candidate.headers === 'object' && candidate.headers !== null
        ? (candidate.headers as Record<string, string>)
        : {},
    occurredAt,
    correlationId:
      typeof candidate.correlationId === 'string' ? candidate.correlationId : undefined,
    causationId: typeof candidate.causationId === 'string' ? candidate.causationId : undefined,
  };
}
