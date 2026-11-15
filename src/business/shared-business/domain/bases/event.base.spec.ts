import { DomainEvent } from './event.base';

class ConcreteEvent extends DomainEvent {}

class EventWithMeta extends DomainEvent {
  constructor(options?: {
    correlationId?: string;
    causationId?: string;
    headers?: Record<string, string>;
  }) {
    super(options);
  }
}

describe('DomainEvent', () => {
  it('generates a unique eventId', () => {
    const a = new ConcreteEvent();
    const b = new ConcreteEvent();
    expect(a.eventId).toBeTruthy();
    expect(b.eventId).toBeTruthy();
    expect(a.eventId).not.toBe(b.eventId);
  });

  it('stamps occurredAt with a Date', () => {
    const before = Date.now();
    const event = new ConcreteEvent();
    const after = Date.now();

    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('defaults version to 1', () => {
    expect(new ConcreteEvent().version).toBe(1);
  });

  it('carries correlation metadata when supplied', () => {
    const event = new EventWithMeta({
      correlationId: 'corr-1',
      causationId: 'cause-1',
      headers: { 'x-tenant': 'tenant-1' },
    });

    expect(event.correlationId).toBe('corr-1');
    expect(event.causationId).toBe('cause-1');
    expect(event.headers).toEqual({ 'x-tenant': 'tenant-1' });
  });

  it('leaves metadata undefined when not supplied', () => {
    const event = new EventWithMeta();
    expect(event.correlationId).toBeUndefined();
    expect(event.causationId).toBeUndefined();
    expect(event.headers).toBeUndefined();
  });
});
