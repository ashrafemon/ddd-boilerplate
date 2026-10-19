import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MessageEnvelope } from '@platform/events/ports/in-process-event-bus.port';

/**
 * In-process listener for GoodReceiptNote domain events via
 * @nestjs/event-emitter. Receives the canonical envelope; the business payload
 * is `message.payload`.
 */
@Injectable()
export class GrnEventEmitterListener {
  private readonly logger = new Logger(GrnEventEmitterListener.name);

  @OnEvent('GrnCreated')
  onGrnCreated(message: MessageEnvelope): void {
    this.logger.log(`[EventEmitter] GrnCreated received for ${message.aggregateId}`);
  }
}
