import { RabbitMQModule as GoRabbitMqModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQConfigAdapter } from './rabbitmq.adapter';

@Module({
  imports: [
    GoRabbitMqModule.forRootAsync({
      imports: [ConfigModule],
      inject: [RabbitMQConfigAdapter],
      useFactory: (config: RabbitMQConfigAdapter) => config.createRabbitMQOptions(),
    }),
  ],
})
export class RabbitMQModule {}
