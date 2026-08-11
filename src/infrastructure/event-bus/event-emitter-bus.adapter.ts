import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '../../shared-business/event/domain-event';
import { EventBusPort } from '../../shared-kernel/ports/event-bus/event-bus.port';

/**
 * In-process event bus backed by @nestjs/event-emitter (EventEmitter2).
 */
@Injectable()
export class EventEmitterBusAdapter implements EventBusPort<DomainEvent> {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  public publish(event: DomainEvent): void {
    void this.eventEmitter.emit(event.eventType, event);
  }

  public publishAll(events: DomainEvent[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }

  public subscribe(eventType: string, handler: (event: DomainEvent) => void | Promise<void>): void {
    this.eventEmitter.on(eventType, handler);
  }
}
