import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusPort } from '../../shared-kernel/ports/event-bus/event-bus.port';
import { EventEmitterBusAdapter } from './event-emitter-bus.adapter';

/**
 * Infrastructure event bus module. Implements the platform event bus port
 * with the in-process EventEmitter transport.
 */
@Global()
@Module({
  imports: [EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 50 })],
  providers: [
    { provide: EventBusPort, useClass: EventEmitterBusAdapter },
    EventEmitterBusAdapter,
  ],
  exports: [EventBusPort],
})
export class EventBusModule {}
