import { DomainEvent } from './event.base';

export abstract class AggregateRoot {
  private readonly domainEvents: DomainEvent[] = [];

  protected addEvent(event: DomainEvent): void {
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
