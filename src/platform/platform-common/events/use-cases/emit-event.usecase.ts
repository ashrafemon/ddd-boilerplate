import { Injectable } from '@nestjs/common';
import { MessageEnvelope } from '../ports/in-process-event-bus.port';
import { NestEventBusAdapter } from '../adapters/nest-event-bus.adapter';

/**
 * Use case: emit an envelope to the local in-process listeners.
 *
 * One operation per file. It depends on the emitter port, never on the Nest
 * adapter, so the bus can be swapped without touching the use case.
 */
@Injectable()
export class EmitEventUseCase {
  constructor(private readonly emitter: NestEventBusAdapter) {}

  execute(envelope: MessageEnvelope): void {
    this.emitter.emit(envelope.eventType, envelope);
  }
}
