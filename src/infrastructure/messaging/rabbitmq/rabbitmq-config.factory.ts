import { ConfigService } from '@config/config.service';
import { MessageHandlerErrorBehavior } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RabbitMQConfigFactory {
  createRabbitMQOptions(config: ConfigService) {
    const rabbitMqConfig = config.getRabbitMQ();

    return {
      uri: rabbitMqConfig.url,
      exchanges: [
        {
          name: rabbitMqConfig.exchange ?? 'erp.events',
          type: 'topic',
          options: { durable: true },
        },
      ],
      connectionInitOptions: { wait: false, timeout: 10_000 },
      defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
      defaultPublishOptions: { persistent: true },
    };
  }
}
