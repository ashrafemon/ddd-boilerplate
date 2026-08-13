import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { IntegrationMessage } from '@business/shared-business/ports';

const EXCHANGE = 'erp.events';
const QUEUE = 'purchase-order-created.erp';

@Injectable()
export class PurchaseOrderRabbitMQConsumer {
  private readonly logger = new Logger(PurchaseOrderRabbitMQConsumer.name);

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: 'PurchaseOrderCreated',
    queue: QUEUE,
    queueOptions: { durable: true },
  })
  onPurchaseOrderCreated(message: IntegrationMessage): void {
    this.logger.log(`[RabbitMQ] PurchaseOrderCreated received for ${message.aggregateId}`);
  }
}
