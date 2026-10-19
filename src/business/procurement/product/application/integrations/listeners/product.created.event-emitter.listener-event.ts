import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MessageEnvelope } from '@platform/events/ports/in-process-event-bus.port';

/**
 * In-process listener for Product domain events via @nestjs/event-emitter.
 * Registered as a provider (not a controller) using the @OnEvent decorator.
 * Receives the canonical envelope; the business payload is `message.payload`.
 */
@Injectable()
export class ProductEventEmitterListener {
  private readonly logger = new Logger(ProductEventEmitterListener.name);

  @OnEvent('ProductCreated')
  onProductCreated(message: MessageEnvelope): void {
    this.logger.log(`[EventEmitter] ProductCreated received for ${message.aggregateId}`);
  }
}
