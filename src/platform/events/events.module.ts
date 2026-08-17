import { Global, Module } from '@nestjs/common';
import { IN_PROCESS_EVENT_BUS } from '@shared-kernel/ports/event-bus.port';
import { NestEventBusAdapter } from './nest-event-bus.adapter';
import { DefaultMessageRoutingPolicy, MESSAGE_ROUTING_POLICY } from './message-routing.policy';

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
    { provide: IN_PROCESS_EVENT_BUS, useExisting: NestEventBusAdapter },
    { provide: MESSAGE_ROUTING_POLICY, useExisting: DefaultMessageRoutingPolicy },
  ],
  exports: [IN_PROCESS_EVENT_BUS, MESSAGE_ROUTING_POLICY],
})
export class EventsModule {}
