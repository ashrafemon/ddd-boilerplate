import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { MessageEnvelope } from '../ports/in-process-event-bus.port';

/**
 * Nest adapter — wraps EventEmitter2 wildcard dispatch.
 *
 * Emits on `envelope.eventType`, so `@OnEvent('<EventType>')` listeners and
 * `onAny` projections both receive the same canonical envelope. Best-effort:
 * a throwing listener is logged, never propagated to the outbox dispatcher.
 */
@Injectable()
export class NestEventBusAdapter {
  private readonly logger = new Logger(NestEventBusAdapter.name);

  constructor(private readonly emitter: EventEmitter2) {}

  emit(envelope: MessageEnvelope): void {
    try {
      this.emitter.emit(envelope.eventType, envelope);
    } catch (err) {
      this.logger.error(
        `In-process listener for ${envelope.eventType} threw: ${FailureMessage.of(err)}`,
      );
    }
  }
}
