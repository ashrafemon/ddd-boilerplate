import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageEnvelope } from '../ports/in-process-event-bus.port';

/**
 * Nest adapter for the in-process emitter — wraps EventEmitter2.
 *
 * Implements `EventEmitterPort`. Emits on `envelope.eventType`, so
 * `@OnEvent('<EventType>')` listeners and `onAny` projections both receive the
 * same canonical envelope. Best-effort: a throwing listener is logged, never
 * propagated to the outbox dispatcher.
 */
@Injectable()
export class NestEventBusAdapter {
  private readonly logger = new Logger(NestEventBusAdapter.name);

  constructor(private readonly emitter: EventEmitter2) {}

  emit(eventType: string, envelope: MessageEnvelope): void {
    try {
      this.emitter.emit(eventType, envelope);
    } catch (err) {
      this.logger.error(
        `In-process listener for ${eventType} threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
