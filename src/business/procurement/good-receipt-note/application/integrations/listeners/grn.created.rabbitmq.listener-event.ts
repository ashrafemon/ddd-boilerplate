import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import type { OutboxEnvelope } from '@platform/outbox/outbox.types';

const EXCHANGE = 'erp.events';
const QUEUE = 'grn-created.erp';

@Injectable()
export class GrnRabbitMQListener {
  private readonly logger = new Logger(GrnRabbitMQListener.name);

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: 'GrnCreated',
    queue: QUEUE,
    queueOptions: { durable: true },
  })
  onGrnCreated(message: OutboxEnvelope): void {
    this.logger.log(`[RabbitMQ] GrnCreated received for ${message.aggregateId}`);
  }
}
