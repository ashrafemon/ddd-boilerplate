import { ConfigService } from '@config/config.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import {
  IntegrationMessage,
  MessagePublisher,
} from '@platform/messaging/ports/message-publisher.port';

/**
 * RabbitMQ publisher adapter. Publishes the *whole* integration envelope to
 * the configured topic exchange, using the event type as routing key, so a
 * `@RabbitSubscribe` handler receives the same shape the Kafka and SQS
 * transports deliver (event type, aggregate id, payload, headers).
 */
@Injectable()
export class RabbitMQPublisherAdapter implements MessagePublisher {
  private readonly exchange: string;

  constructor(
    private readonly amqp: AmqpConnection,
    config: ConfigService,
  ) {
    this.exchange = config.getRabbitMQ().exchange;
  }

  public async publish(message: IntegrationMessage): Promise<void> {
    await this.amqp.publish(
      this.exchange,
      message.eventType,
      {
        eventType: message.eventType,
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        payload: message.payload,
        headers: message.headers ?? {},
        occurredAt: message.occurredAt.toISOString(),
      },
      { persistent: true, headers: message.headers ?? {} },
    );
  }
}
