import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProductCreated } from '../../domain/events/product.events';

/**
 * In-process consumer for Product domain events via @nestjs/event-emitter.
 * Registered as a provider (not a controller) using the @OnEvent decorator.
 */
@Injectable()
export class ProductEventEmitterConsumer {
  private readonly logger = new Logger(ProductEventEmitterConsumer.name);

  @OnEvent('ProductCreated')
  onProductCreated(event: ProductCreated): void {
    this.logger.log(`[EventEmitter] Product ${event.productId.toString()} created`);
  }
}
