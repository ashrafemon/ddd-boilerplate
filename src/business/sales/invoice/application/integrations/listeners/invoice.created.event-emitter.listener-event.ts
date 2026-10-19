import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MessageEnvelope } from '@platform/events/ports/in-process-event-bus.port';

/**
 * In-process listener for Invoice domain events via @nestjs/event-emitter.
 * Registered as a provider (not a controller) using the @OnEvent decorator.
 * Receives the canonical envelope; the business payload is `message.payload`.
 */
@Injectable()
export class InvoiceEventEmitterListener {
  private readonly logger = new Logger(InvoiceEventEmitterListener.name);

  @OnEvent('InvoiceCreated')
  onInvoiceCreated(message: MessageEnvelope): void {
    this.logger.log(`[EventEmitter] InvoiceCreated received for ${message.aggregateId}`);
  }
}
