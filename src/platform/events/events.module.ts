import { Global, Module } from '@nestjs/common';
import { InProcessEventBus } from '@shared-kernel/ports/event-bus.port';
import { NestEventBusAdapter } from './nest-event-bus.adapter';
import { DefaultMessageRoutingPolicy, MessageRoutingPolicy } from './message-routing.policy';

/**
 * Events sub-system — in-process domain event bus and the broker routing
 * policy for integration events. Global so business modules and the outbox
 * publisher can inject the port tokens anywhere.
 */
@Global()
@Module({
  providers: [
    NestEventBusAdapter,
    DefaultMessageRoutingPolicy,
    { provide: InProcessEventBus, useExisting: NestEventBusAdapter },
    { provide: MessageRoutingPolicy, useExisting: DefaultMessageRoutingPolicy },
  ],
  exports: [InProcessEventBus, MessageRoutingPolicy],
})
export class EventsModule {}
