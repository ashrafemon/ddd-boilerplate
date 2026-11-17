import { ConfigService } from '@config/config.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { buildRabbitMQOptions } from './rabbitmq-config.factory';

/**
 * RabbitMQ client module — connection initialization only.
 *
 * Registers the RabbitMQ connection (topic exchange `erp.events`) from the
 * typed config facade and re-exports RabbitMQModule so consumers get
 * AmqpConnection and @RabbitSubscribe handler registration. No ports or
 * adapters live here.
 */
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildRabbitMQOptions,
    }),
  ],
  exports: [RabbitMQModule],
})
export class RabbitMqClientModule {}
