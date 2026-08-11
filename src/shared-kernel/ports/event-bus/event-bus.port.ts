/**
 * In-process event bus for domain/application events (EventEmitter2 backed).
 *
 * In-process events are NOT a replacement for distributed integration
 * events. Distributed events must go through the Outbox + messaging
 * infrastructure.
 */
export abstract class EventBusPort<TEvent = object> {
  public abstract publish(event: TEvent): void;
  public abstract publishAll(events: TEvent[]): void;
  public abstract subscribe(
    eventType: string,
    handler: (event: TEvent) => void | Promise<void>,
  ): void;
}
