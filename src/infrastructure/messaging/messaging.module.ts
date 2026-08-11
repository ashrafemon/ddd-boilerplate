import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SqsModule } from '@ssut/nestjs-sqs';
import { KafkaService } from './kafka/kafka.service';
import { RabbitMQService } from './rabbitmq/rabbitmq.service';
import { SqsService } from './sqs/sqs.service';

@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [RabbitMQService],
      useFactory: (service: RabbitMQService) => {
        return service.createRabbitMQOptions();
      },
    }),

    SqsModule.registerAsync({
      imports: [],
      inject: [SqsService],
      useFactory: (service: SqsService) => {
        return service.createSqsOptions();
      },
    }),

    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 50 }),
  ],
  providers: [RabbitMQService, KafkaService, SqsService],
  exports: [],
})
export class MessagingModule {}
