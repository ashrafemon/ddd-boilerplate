import { Module } from '@nestjs/common';
import { INFRA_CACHE_MODULE } from './cache/cache.module';
import { ContextModule } from './context/context.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationModule } from './notification/notification.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';

/**
 * Infrastructure layer — only client initialization/setup.
 *
 * Each sub-module registers third-party clients (Prisma, Kafka, RabbitMQ,
 * SQS, Redis, Memcached, S3, SES, SNS, CLS). No ports or adapters live here;
 * the platform layer wraps these clients into services for business modules.
 *
 * Deliberately NOT `@Global()`: raw clients must stay invisible to business
 * modules, so every consumer has to import this module (or a sub-module)
 * explicitly. The only global registration is CLS, which the CLS library
 * requires to be global for request-scoped transactions to work.
 */
@Module({
  imports: [
    INFRA_CACHE_MODULE,
    PrismaModule,
    ContextModule,
    NotificationModule,
    MessagingModule,
    QueueModule,
    StorageModule,
  ],
  exports: [
    INFRA_CACHE_MODULE,
    PrismaModule,
    ContextModule,
    NotificationModule,
    MessagingModule,
    QueueModule,
    StorageModule,
  ],
})
export class InfrastructureModule {}
