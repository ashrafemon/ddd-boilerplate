import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { IntegrationMessage } from '@shared-kernel/ports';

const EXCHANGE = 'erp.events';
const QUEUE = 'product-created.erp';

/**
 * RabbitMQ listener for Product integration events. Sits in the business
 * aggregate's application layer and follows the @golevelup/nestjs-rabbitmq
 * pattern. Workers delegate to use cases/facades — never infrastructure.
 */
@Injectable()
export class ProductRabbitMQListener {
  private readonly logger = new Logger(ProductRabbitMQListener.name);

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: 'ProductCreated',
    queue: QUEUE,
    queueOptions: { durable: true },
  })
  onProductCreated(message: IntegrationMessage): void {
    this.logger.log(`[RabbitMQ] ProductCreated received for ${message.aggregateId}`);
  }
}