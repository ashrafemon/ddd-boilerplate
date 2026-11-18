import { Injectable } from '@nestjs/common';
import { MessageEnvelope } from '../inbound/ports/in-process-event-bus.port';
import { EventEmitterPort } from '../outbound/ports/event-emitter.port';

/**
 * Use case: emit an envelope to the local in-process listeners.
 *
 * One operation per file. It depends on the emitter port, never on the Nest
 * adapter, so the bus can be swapped without touching the use case.
 */
@Injectable()
export class EmitEventUseCase {
  constructor(private readonly emitter: EventEmitterPort) {}

  execute(envelope: MessageEnvelope): void {
    this.emitter.emit(envelope.eventType, envelope);
  }
}
