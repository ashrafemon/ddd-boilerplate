import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { ContextModule } from './context/context.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationModule } from './notification/notification.module';
import { StorageModule } from './storage/storage.module';

/**
 * Infrastructure layer — only client initialization/setup.
 *
 * Each sub-module registers third-party clients (Prisma, Kafka, RabbitMQ,
 * SQS, Redis, Memcached, S3, SES, SNS, CLS). No ports or adapters are
 * defined here; those live in the platform layer.
 */
@Module({
  imports: [
    PrismaModule,
    CacheModule.forRootAsync(),
    MessagingModule,
    ContextModule,
    NotificationModule,
    StorageModule,
  ],
})
export class InfrastructureModule {}
