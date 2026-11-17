import { EventEmitterModule } from '@nestjs/event-emitter';
import { Module } from '@nestjs/common';
import { BullMqModule } from './bullmq/bullmq.module';
import { ContextModule } from './context/context.module';
import { KafkaModule } from './kafka/kafka.module';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitMqClientModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { SesModule } from './ses/ses.module';
import { SnsModule } from './sns/sns.module';
import { SqsClientModule } from './sqs/sqs.module';
import { SecretsManagerModule } from './secrets/secrets.module';
import { PuppeteerModule } from './puppeteer/puppeteer.module';
import { S3Module } from './s3/s3.module';

/**
 * Infrastructure layer — client initialization/setup only.
 *
 * Each client folder sits directly under `infrastructure/` — one row per
 * client, each with its own module: Prisma, Redis, RabbitMQ, Kafka, SQS,
 * BullMQ, SES, SNS, S3, Secrets Manager, Puppeteer, CLS. No ports or adapters live here; the
 * platform layer wraps these clients into services for business modules.
 *
 * Outbox and Inbox live here as directories but are wired by PlatformModule
 * (not InfrastructureModule) to avoid a circular dependency:
 *   OutboxModule → ContextModule → InfrastructureModule
 * If InfrastructureModule also imported OutboxModule, that would form a cycle.
 *
 * Deliberately NOT `@Global()`: raw clients must stay invisible to business
 * modules, so every consumer has to import this module (or a client module)
 * explicitly. The only global registration is CLS, which the CLS library
 * requires to be global for request-scoped transactions to work.
 */
@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 50 }),
    RedisModule,
    PrismaModule,
    ContextModule,
    SesModule,
    SnsModule,
    RabbitMqClientModule,
    KafkaModule,
    SqsClientModule,
    BullMqModule,
    S3Module,
    SecretsManagerModule,
    PuppeteerModule,
  ],
  exports: [
    EventEmitterModule,
    RedisModule,
    PrismaModule,
    ContextModule,
    SesModule,
    SnsModule,
    RabbitMqClientModule,
    KafkaModule,
    SqsClientModule,
    BullMqModule,
    S3Module,
    SecretsManagerModule,
    PuppeteerModule,
  ],
})
export class InfrastructureModule {}
