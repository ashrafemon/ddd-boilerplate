import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProductCreated } from '../../../domain/domain-events/product.created.event';

/**
 * In-process listener for Product domain events via @nestjs/event-emitter.
 * Registered as a provider (not a controller) using the @OnEvent decorator.
 */
@Injectable()
export class ProductEventEmitterListener {
  private readonly logger = new Logger(ProductEventEmitterListener.name);

  @OnEvent('ProductCreated')
  onProductCreated(event: ProductCreated): void {
    this.logger.log(`[EventEmitter] Product ${event.productId.toString()} created`);
  }
}