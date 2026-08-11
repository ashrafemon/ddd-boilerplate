import { MessageHandlerErrorBehavior } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RabbitMQConfigFactory {
  constructor(private readonly config: ConfigService) {}

  public createRabbitMQOptions() {
    const rabbitmq = this.config.get<{ url: string; exchange: string }>('messaging.rabbitmq', {
      url: 'amqp://localhost:5672',
      exchange: 'erp.events',
    });

    return {
      uri: rabbitmq.url,
      exchanges: [{ name: rabbitmq.exchange, type: 'topic', options: { durable: true } }],
      connectionInitOptions: { wait: false, timeout: 10_000 },
      defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
      defaultPublishOptions: { persistent: true },
    };
  }
}
