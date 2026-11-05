import { Injectable } from '@nestjs/common';
import { NestEventBusAdapter } from '../adapters/nest-event-bus.adapter';
import { MessageEnvelope } from '../ports/in-process-event-bus.port';

/**
 * Use case: emit an envelope to the local in-process listeners. One operation
 * per file — it only forwards to the Nest adapter.
 */
@Injectable()
export class EmitEventUseCase {
  constructor(private readonly adapter: NestEventBusAdapter) {}

  execute(envelope: MessageEnvelope): void {
    this.adapter.emit(envelope);
  }
}
