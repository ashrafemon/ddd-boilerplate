import { ConfigService } from '@config/config.service';
import { MessageHandlerErrorBehavior } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RabbitMQService {
  constructor(private readonly configService: ConfigService) {}

  createRabbitMQOptions() {
    const config = this.configService.getRabbitMQ();
    return {
      uri: config.url,
      exchanges: [{ name: config.exchange, type: 'topic', options: { durable: true } }],
      connectionInitOptions: { wait: false, timeout: 10_000 },
      defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
      defaultPublishOptions: { persistent: true },
    };
  }
}
