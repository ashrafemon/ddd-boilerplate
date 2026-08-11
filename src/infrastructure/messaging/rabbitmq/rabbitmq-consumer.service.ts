import { Injectable } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { IntegrationMessage } from '../../../shared-kernel/ports/messaging/integration-message';
import { IntegrationMessageProcessor } from '../../../platform/messaging/integration-message-processor.service';
import {
  ERP_EVENTS_DEAD_LETTER_EXCHANGE,
  ERP_EVENTS_DEAD_LETTER_QUEUE,
  ERP_EVENTS_EXCHANGE,
  ERP_EVENTS_QUEUE,
} from '../../../platform/messaging/messaging.constants';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';

/**
 * RabbitMQ consumer for integration events using @golevelup/nestjs-rabbitmq's
 * decorator-based consumption model.
 *
 * The handler binds to every routing key on the ERP exchange. Successful
 * handling auto-acks; failures nack without requeue (configured globally) so
 * the message is routed to the dead-letter queue.
 */
@Injectable()
export class ErpRabbitMqConsumer {
  constructor(
    private readonly processor: IntegrationMessageProcessor,
    private readonly logger: LoggerPort,
  ) {}

  @RabbitSubscribe({
    exchange: ERP_EVENTS_EXCHANGE,
    routingKey: '#',
    queue: ERP_EVENTS_QUEUE,
    queueOptions: {
      durable: true,
      deadLetterExchange: ERP_EVENTS_DEAD_LETTER_EXCHANGE,
      deadLetterRoutingKey: ERP_EVENTS_DEAD_LETTER_QUEUE,
    },
    allowNonJsonMessages: true,
  })
  public async handleIntegrationEvent(message: IntegrationMessage): Promise<void> {
    await this.processor.process(message);
    this.logger.debug('rabbitmq-message-processed', {
      eventId: message.eventId,
      eventType: message.eventType,
    });
  }
}
