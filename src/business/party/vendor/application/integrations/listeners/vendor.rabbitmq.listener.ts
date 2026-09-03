import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { IntegrationMessage } from '@shared-kernel/ports';

const EXCHANGE = 'erp.events';
const QUEUE = 'vendor-created.erp';

@Injectable()
export class VendorRabbitMQListener {
  private readonly logger = new Logger(VendorRabbitMQListener.name);

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: 'VendorCreated',
    queue: QUEUE,
    queueOptions: { durable: true },
  })
  onVendorCreated(message: IntegrationMessage): void {
    this.logger.log(`[RabbitMQ] VendorCreated received for ${message.aggregateId}`);
  }
}