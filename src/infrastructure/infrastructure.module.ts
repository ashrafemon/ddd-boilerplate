import { Global, Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { ContextModule } from './context/context.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationModule } from './notification/notification.module';
import { ObservabilityModule } from './observability/observability.module';
import { StorageModule } from './storage/storage.module';

/**
 * Infrastructure layer — only client adapters and their wiring modules.
 *
 * Each client implements a port defined by the shared-kernel/platform layer
 * (request context, observability, event bus, cache, messaging, notification,
 * storage, database). There is no business or platform service logic here.
 *
 * ObservabilityModule provides LoggerPort, which every infra client depends on.
 * ContextModule registers the CLS store (ClsService) used by the HTTP
 * interceptors and the transactional unit-of-work plugin.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    CacheModule.forRootAsync(),
    MessagingModule,
    ContextModule,
    ObservabilityModule,
    NotificationModule,
    StorageModule,
  ],
})
export class InfrastructureModule {}
