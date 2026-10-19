import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import type { OutboxEnvelope } from '@platform/outbox/outbox.types';

const EXCHANGE = 'erp.events';
const QUEUE = 'invoice-created.erp';

/**
 * RabbitMQ listener for Invoice integration events. Sits in the business
 * aggregate's application layer and follows the @golevelup/nestjs-rabbitmq
 * pattern. Workers delegate to use cases/facades — never infrastructure.
 */
@Injectable()
export class InvoiceRabbitMQListener {
  private readonly logger = new Logger(InvoiceRabbitMQListener.name);

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: 'InvoiceCreated',
    queue: QUEUE,
    queueOptions: { durable: true },
  })
  onInvoiceCreated(message: OutboxEnvelope): void {
    this.logger.log(`[RabbitMQ] InvoiceCreated received for ${message.aggregateId}`);
  }
}
