import { Module } from '@nestjs/common';
import { InProcessEventBus } from './inbound/ports/in-process-event-bus.port';
import { EventBusAdapter } from './inbound/adapters/event-bus.adapter';
import { EventEmitterPort } from './outbound/ports/event-emitter.port';
import { NestEventBusAdapter } from './outbound/adapters/nest-event-bus.adapter';
import { EmitEventUseCase } from './use-cases/emit-event.usecase';

/**
 * Platform Event Bus module — best-effort in-process dispatch.
 *
 * A thin emit wrapper over EventEmitter2: the Outbox dispatcher emits the same
 * canonical envelope the brokers carry, and business `@OnEvent` listeners read
 * `message.payload`. No routing table, no registries, no rehydration.
 *
 * This module is NOT global. Business modules must import PlatformModule.
 */
@Module({
  providers: [
    // Outbound adapter → outbound port
    NestEventBusAdapter,
    { provide: EventEmitterPort, useExisting: NestEventBusAdapter },

    // Use case
    EmitEventUseCase,

    // Inbound port implementation
    EventBusAdapter,
    { provide: InProcessEventBus, useExisting: EventBusAdapter },
  ],
  exports: [InProcessEventBus],
})
export class EventsModule {}
