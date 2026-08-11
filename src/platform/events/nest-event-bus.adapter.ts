import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { InProcessEventBus } from '@business/shared-business/ports/event-bus.port';

/**
 * In-process domain event bus backed by EventEmitter2. Used for local
 * reactions (sagas, listeners) where external delivery is not required.
 */
@Injectable()
export class NestEventBusAdapter implements InProcessEventBus {
  constructor(private readonly emitter: EventEmitter2) {}

  publish(event: DomainEvent): void {
    this.emitter.emit(event.constructor.name, event);
  }

  publishAll(events: readonly DomainEvent[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }
}
