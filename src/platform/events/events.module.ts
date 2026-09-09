import { Global, Module } from '@nestjs/common';
import { InProcessEventBus } from '@platform/events/ports/event-bus.port';
import { NestEventBusAdapter } from './nest-event-bus.adapter';
import { DefaultMessageRoutingPolicy, MessageRoutingPolicy } from './message-routing.policy';

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
