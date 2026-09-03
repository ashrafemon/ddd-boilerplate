import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { IntegrationMessage } from '@shared-kernel/ports';

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
  onGrnCreated(message: IntegrationMessage): void {
    this.logger.log(`[RabbitMQ] GrnCreated received for ${message.aggregateId}`);
  }
}