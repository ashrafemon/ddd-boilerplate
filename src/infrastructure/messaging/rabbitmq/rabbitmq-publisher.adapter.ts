import { ConfigService } from '@nestjs/config';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import {
  IntegrationMessage,
  MessagePublisher,
} from '@business/shared-business/ports/message-publisher.port';

/**
 * RabbitMQ publisher adapter. Publishes integration messages to the
 * configured topic exchange using the event type as routing key.
 */
@Injectable()
export class RabbitMQPublisherAdapter implements MessagePublisher {
  private readonly exchange: string;

  constructor(
    private readonly amqp: AmqpConnection,
    config: ConfigService,
  ) {
    const rabbitmq = config.get<{ exchange: string }>('messaging.rabbitmq', {
      exchange: 'erp.events',
    });
    this.exchange = rabbitmq.exchange;
  }

  public async publish(message: IntegrationMessage): Promise<void> {
    await this.amqp.publish(this.exchange, message.eventType, message.payload, {
      persistent: true,
      headers: message.headers ?? {},
    });
  }
}
