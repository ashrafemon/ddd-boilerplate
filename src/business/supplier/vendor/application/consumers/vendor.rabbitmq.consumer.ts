import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { IntegrationMessage } from '@business/shared-business/ports/message-publisher.port';

const EXCHANGE = 'erp.events';
const QUEUE = 'vendor-created.erp';

@Injectable()
export class VendorRabbitMQConsumer {
  private readonly logger = new Logger(VendorRabbitMQConsumer.name);

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
