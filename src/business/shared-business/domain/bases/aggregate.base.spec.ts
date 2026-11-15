import { AggregateRoot } from './aggregate.base';
import { DomainEvent } from './event.base';
import { Entity } from './entity.base';

class TestEvent extends DomainEvent {
  constructor(public readonly payload: string) {
    super();
  }
}

class TestAggregate extends AggregateRoot<string> {
  constructor(id: string) {
    super(id);
  }

  raise(payload: string): void {
    this.addEvent(new TestEvent(payload));
  }

  get versionValue(): number {
    return this.getVersion();
  }
}

describe('AggregateRoot', () => {
  it('exposes its id', () => {
    const aggregate = new TestAggregate('agg-1');
    expect(aggregate.id).toBe('agg-1');
  });

  it('starts at version 1', () => {
    const aggregate = new TestAggregate('agg-1');
    expect(aggregate.getVersion()).toBe(1);
  });

  it('collects raised domain events', () => {
    const aggregate = new TestAggregate('agg-1');
    aggregate.raise('first');
    aggregate.raise('second');

    const events = aggregate.pullEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toBeInstanceOf(TestEvent);
    expect((events[0] as TestEvent).payload).toBe('first');
    expect((events[1] as TestEvent).payload).toBe('second');
  });

  it('drains events on pullEvents', () => {
    const aggregate = new TestAggregate('agg-1');
    aggregate.raise('only');

    expect(aggregate.pullEvents()).toHaveLength(1);
    expect(aggregate.pullEvents()).toHaveLength(0);
  });

  it('returns a defensive copy from pullEvents', () => {
    const aggregate = new TestAggregate('agg-1');
    aggregate.raise('one');

    const first = aggregate.pullEvents();
    // second call must be empty regardless of the first array
    expect(aggregate.pullEvents()).toHaveLength(0);
    expect(first).toHaveLength(1);
  });

  it('extends Entity', () => {
    const aggregate = new TestAggregate('agg-1');
    expect(aggregate).toBeInstanceOf(Entity);
  });
});
