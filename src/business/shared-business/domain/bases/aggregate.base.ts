import { DomainEvent } from './event.base';
import { Entity } from './entity.base';

/**
 * Aggregate root base. Holds the version for optimistic concurrency and a
 * snapshot of raised domain events (`pullEvents` drains them). Entities,
 * aggregates and value objects are kept separate — invariants and policies are
 * enforced through the shared registries, never by cross-importing domain
 * classes.
 */
export abstract class AggregateRoot<ID> extends Entity<ID> {
  private readonly domainEvents: DomainEvent[] = [];
  protected version = 1;

  protected constructor(id: ID) {
    super(id);
  }

  getVersion(): number {
    return this.version;
  }

  /**
   * Record a domain event. Factories use this to raise creation events;
   * aggregate methods use it for state transitions. The use case drains the
   * snapshot with `pullEvents()` and persists each event to the outbox.
   */
  public addEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  protected removeEvent(event: DomainEvent): void {
    const index = this.domainEvents.indexOf(event);

    if (index >= 0) {
      this.domainEvents.splice(index, 1);
    }
  }

  protected clearEvents(): void {
    this.domainEvents.length = 0;
  }

  pullEvents(): readonly DomainEvent[] {
    const events = [...this.domainEvents];
    this.clearEvents();
    return events;
  }
}
