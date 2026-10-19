import { Injectable } from '@nestjs/common';
import { InProcessEventBus, MessageEnvelope } from '../ports/in-process-event-bus.port';
import { EmitEventUseCase } from '../usecases/emit-event.usecase';

/**
 * Event Bus service facade — the single entry point for the public
 * `InProcessEventBus` port. Delegates to the use case; holds no rules.
 */
@Injectable()
export class EventBusService implements InProcessEventBus {
  constructor(private readonly emitEvent: EmitEventUseCase) {}

  emit(envelope: MessageEnvelope): void {
    this.emitEvent.execute(envelope);
  }
}
