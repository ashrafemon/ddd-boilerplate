import { Global, Module } from '@nestjs/common';
import { RedisModule } from './cache/redis/redis.module';
import { NestjsClsModule } from './context/nestcls/nestcls.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { RabbitMQModule } from './message/rabbitmq/rabbitmq.module';

@Global()
@Module({
  imports: [PrismaModule, NestjsClsModule, RabbitMQModule, RedisModule],
  exports: [PrismaModule, NestjsClsModule, RabbitMQModule, RedisModule],
})
export class InfrastructureModule {}
