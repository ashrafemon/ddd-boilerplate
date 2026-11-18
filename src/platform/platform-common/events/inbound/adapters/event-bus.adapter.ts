import { Injectable } from '@nestjs/common';
import { InProcessEventBus, MessageEnvelope } from '../ports/in-process-event-bus.port';
import { EmitEventUseCase } from '../../use-cases/emit-event.usecase';

/**
 * Inbound adapter implementing the public `InProcessEventBus`.
 *
 * Delegates to the emit use case; holds no rules. The outbox dispatcher is the
 * only caller.
 */
@Injectable()
export class EventBusAdapter implements InProcessEventBus {
  constructor(private readonly emitEvent: EmitEventUseCase) {}

  emit(envelope: MessageEnvelope): void {
    this.emitEvent.execute(envelope);
  }
}
