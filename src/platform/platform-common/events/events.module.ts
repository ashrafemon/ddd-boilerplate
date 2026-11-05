import { Module } from '@nestjs/common';
import { InProcessEventBus } from './ports/in-process-event-bus.port';
import { EventBusService } from './services/event-bus.service';
import { EmitEventUseCase } from './usecases/emit-event.usecase';
import { NestEventBusAdapter } from './adapters/nest-event-bus.adapter';

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
    NestEventBusAdapter,
    EmitEventUseCase,
    EventBusService,
    { provide: InProcessEventBus, useExisting: EventBusService },
  ],
  exports: [InProcessEventBus],
})
export class EventsModule {}
