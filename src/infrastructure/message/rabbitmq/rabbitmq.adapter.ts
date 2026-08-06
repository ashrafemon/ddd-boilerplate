import { RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type MessageConnectionConfig = { url: string };

@Injectable()
export class RabbitMQConfigAdapter {
  constructor(private readonly config: ConfigService) {}

  createRabbitMQOptions(): RabbitMQConfig {
    const rabbitMQConfig = this.config.getOrThrow<MessageConnectionConfig>('message.rabbitmq', {
      url: '',
    });

    return {
      exchanges: [{ name: 'exchange1', type: 'topic' }],
      uri: rabbitMQConfig.url,
      channels: {
        'channel-1': { prefetchCount: 15, default: true },
        'channel-2': { prefetchCount: 2 },
      },
    };
  }
}
