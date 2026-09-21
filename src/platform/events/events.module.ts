import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module';
import { EventBusPort } from './ports/event-bus.port';
import { EventBusService } from './event-bus.service';
import { DomainEventRegistry } from './registries/domain-event.registry';
import { DomainEventDispatcher } from './dispatchers/domain-event.dispatcher';
import { PublishEventUseCase } from './usecases/publish-event.usecase';
import { RegisterEventHandlerUseCase } from './usecases/register-event-handler.usecase';
import { UnregisterEventHandlerUseCase } from './usecases/unregister-event-handler.usecase';
import { MessageRoutingPolicy, DefaultMessageRoutingPolicy } from './message-routing.policy';

/**
 * Platform Event Bus module — event publication and handler dispatch boundary.
 *
 * Business modules register their handlers through the EventBusPort.
 * The Outbox Dispatcher publishes events through this port.
 *
 * This module is NOT global. Business modules must import PlatformModule.
 */
@Module({
  imports: [ContextModule],
  providers: [
    // Registry
    DomainEventRegistry,
    DomainEventDispatcher,

    // Use cases
    PublishEventUseCase,
    RegisterEventHandlerUseCase,
    UnregisterEventHandlerUseCase,

    // Routing
    DefaultMessageRoutingPolicy,
    { provide: MessageRoutingPolicy, useExisting: DefaultMessageRoutingPolicy },

    // Facade → public port
    EventBusService,
    { provide: EventBusPort, useExisting: EventBusService },
  ],
  exports: [EventBusPort, DomainEventRegistry, MessageRoutingPolicy],
})
export class EventsModule {}
