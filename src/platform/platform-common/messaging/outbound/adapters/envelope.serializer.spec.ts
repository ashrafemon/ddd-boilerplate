import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { fromWireEnvelope, toWireEnvelope, WireEnvelope } from './envelope.serializer';

/**
 * Unit — the wire contract shared by RabbitMQ, Kafka and SQS.
 *
 * Every consumer scopes by `tenantId`/`companyId` and dedupes by `eventId`, so a
 * publisher that trims the body breaks listeners silently. One serializer, one
 * shape, three transports.
 */
describe('envelope serializer', () => {
  const envelope: OutboxEnvelope = {
    eventId: 'evt-1',
    eventType: 'inventory.grn.created',
    eventVersion: 3,
    tenantId: 'tenant-1',
    companyId: 'company-1',
    aggregateType: 'GoodReceiptNote',
    aggregateId: 'grn-1',
    payload: { grnId: 'grn-1', amount: 10 },
    headers: { traceparent: 'abc' },
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    correlationId: 'corr-1',
    causationId: 'cause-1',
  };

  it('keeps every field a consumer needs, including tenancy', () => {
    expect(toWireEnvelope(envelope)).toEqual({
      eventId: 'evt-1',
      eventType: 'inventory.grn.created',
      eventVersion: 3,
      tenantId: 'tenant-1',
      companyId: 'company-1',
      aggregateType: 'GoodReceiptNote',
      aggregateId: 'grn-1',
      payload: { grnId: 'grn-1', amount: 10 },
      headers: { traceparent: 'abc' },
      occurredAt: '2026-01-01T00:00:00.000Z',
      correlationId: 'corr-1',
      causationId: 'cause-1',
    });
  });

  it('defaults an absent version and absent ids', () => {
    const wire = toWireEnvelope({ ...envelope, eventVersion: undefined });
    expect(wire.eventVersion).toBe(1);

    const bare = toWireEnvelope({
      ...envelope,
      tenantId: null,
      companyId: null,
      correlationId: undefined,
      causationId: undefined,
    });
    expect(bare.tenantId).toBeNull();
    expect(bare.correlationId).toBeNull();
  });

  it('round-trips through the wire format', () => {
    const back = fromWireEnvelope(toWireEnvelope(envelope));

    expect(back).toEqual(
      expect.objectContaining({
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        eventVersion: 3,
        tenantId: 'tenant-1',
        companyId: 'company-1',
        aggregateId: 'grn-1',
        correlationId: 'corr-1',
        causationId: 'cause-1',
      }),
    );
    expect(back?.occurredAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rejects anything that is not an envelope', () => {
    const wire = toWireEnvelope(envelope) as Partial<WireEnvelope>;

    expect(fromWireEnvelope(null)).toBeNull();
    expect(fromWireEnvelope('nope')).toBeNull();
    expect(fromWireEnvelope({ ...wire, eventId: undefined })).toBeNull();
    expect(fromWireEnvelope({ ...wire, payload: undefined })).toBeNull();
  });
});
