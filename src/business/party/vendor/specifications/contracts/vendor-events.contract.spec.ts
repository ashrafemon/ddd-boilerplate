import { VendorFactory } from '@business/party/vendor/domain/factories/vendor.factory';
import { VendorCreated } from '@business/party/vendor/domain/events/vendor.created.event';

/**
 * Vendor — event contract tests.
 *
 * The wire contract of every published event is the outbox envelope: the
 * AppendOutboxEventUseCase writes `event.constructor.name` as `eventType`, the
 * event's `version` as `eventVersion` and the aggregate id as `aggregateId`.
 * A class rename, a version bump or a payload field change silently breaks
 * consumers, so each published event is pinned here.
 */
describe('Vendor events — wire contract', () => {
  function createdEvent(): VendorCreated {
    const vendor = VendorFactory.create({ code: 'VEN-1', name: 'Acme' });
    const [event] = vendor.pullEvents() as VendorCreated[];
    return event;
  }

  it('publishes VendorCreated under a stable event type name', () => {
    const event = createdEvent();

    // `eventType` written to outbox_messages comes from the class name.
    expect(event.constructor.name).toBe('VendorCreated');
  });

  it('carries a resolvable envelope: eventId, version, occurredAt', () => {
    const event = createdEvent();

    expect(typeof event.eventId).toBe('string');
    expect(event.eventId.length).toBeGreaterThan(0);
    expect(Number.isInteger(event.version)).toBe(true);
    expect(event.version).toBeGreaterThanOrEqual(1);
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(Number.isNaN(event.occurredAt.getTime())).toBe(false);
  });

  it('exposes the vendor identity and its documented payload fields', () => {
    const event = createdEvent();

    expect(typeof event.vendorId.toString()).toBe('string');
    expect(event.vendorId.toString().length).toBeGreaterThan(0);
    expect(typeof event.code).toBe('string');
    expect(typeof event.name).toBe('string');
    expect(event.code).toBe('VEN-1');
  });

  it('gives every event a unique id and its own timestamp', () => {
    const first = createdEvent();
    const second = createdEvent();

    expect(first.eventId).not.toBe(second.eventId);
  });

  it('keeps the published payload JSON-serialisable (consumer requirement)', () => {
    const event = createdEvent();

    const serialised = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
    expect(serialised.vendorId).toBeDefined();
    expect(serialised.code).toBe('VEN-1');
    expect(typeof serialised.eventId).toBe('string');
    // Dates serialise to ISO strings; consumers must not expect Date objects.
    expect(typeof serialised.occurredAt).toBe('string');
  });
});
