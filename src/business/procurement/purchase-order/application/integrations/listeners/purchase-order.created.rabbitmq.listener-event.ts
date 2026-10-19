import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import type { OutboxEnvelope } from '@platform/outbox/outbox.types';

const EXCHANGE = 'erp.events';
const QUEUE = 'purchase-order-created.erp';

@Injectable()
export class PurchaseOrderRabbitMQListener {
  private readonly logger = new Logger(PurchaseOrderRabbitMQListener.name);

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: 'PurchaseOrderCreated',
    queue: QUEUE,
    queueOptions: { durable: true },
  })
  onPurchaseOrderCreated(message: OutboxEnvelope): void {
    this.logger.log(`[RabbitMQ] PurchaseOrderCreated received for ${message.aggregateId}`);
  }
}
