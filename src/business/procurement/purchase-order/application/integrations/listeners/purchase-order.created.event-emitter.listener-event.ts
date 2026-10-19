import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MessageEnvelope } from '@platform/events/ports/in-process-event-bus.port';

/**
 * In-process listener for PurchaseOrder domain events via @nestjs/event-emitter.
 * Receives the canonical envelope; the business payload is `message.payload`.
 */
@Injectable()
export class PurchaseOrderEventEmitterListener {
  private readonly logger = new Logger(PurchaseOrderEventEmitterListener.name);

  @OnEvent('PurchaseOrderCreated')
  onPurchaseOrderCreated(message: MessageEnvelope): void {
    this.logger.log(`[EventEmitter] PurchaseOrderCreated received for ${message.aggregateId}`);
  }
}
