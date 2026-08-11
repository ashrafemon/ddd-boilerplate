import { Entity } from './entity';
import { Identifier } from './identifier';
import { DomainEvent } from '../event/domain-event';

/**
 * Base class for aggregate roots.
 *
 * The aggregate root is the single entry point that protects the invariants
 * of everything inside its aggregate boundary. External code must never mutate
 * child entities directly — it must invoke methods on the aggregate root.
 *
 * Domain events are recorded inside the aggregate and collected by the
 * application layer via {@link pullDomainEvents} to be written to the outbox
 * atomically with the persistence transaction.
 */
export abstract class AggregateRoot<TId extends Identifier> extends Entity<TId> {
  private readonly domainEvents: DomainEvent[] = [];

  protected recordDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents.length = 0;
    return events;
  }

  protected clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }
}
