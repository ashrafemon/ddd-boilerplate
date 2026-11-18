import { ConfigService } from '@config/config.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { RabbitMqPublisherPort } from '../ports/broker-publisher.port';
import { toWireEnvelope } from './envelope.serializer';

/**
 * RabbitMQ publisher adapter. Publishes the *whole* canonical envelope to the
 * configured topic exchange, using the event type as routing key, so a
 * `@RabbitSubscribe` handler receives the same shape the Kafka and SQS
 * transports deliver.
 */
@Injectable()
export class RabbitMQPublisherAdapter implements RabbitMqPublisherPort {
  private readonly exchange: string;

  constructor(
    private readonly amqp: AmqpConnection,
    config: ConfigService,
  ) {
    this.exchange = config.getRabbitMQ().exchange;
  }

  public async publish(envelope: OutboxEnvelope): Promise<void> {
    const headers = envelope.headers ?? {};
    await this.amqp.publish(this.exchange, envelope.eventType, toWireEnvelope(envelope), {
      persistent: true,
      headers,
    });
  }
}
