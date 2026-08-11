import { Global, Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { MessagingModule } from './messaging/messaging.module';

/**
 * Infrastructure layer — only client adapters and their wiring modules.
 *
 * Each client implements a port defined by the shared-kernel/platform layer
 * (request context, observability, event bus, cache, messaging, notification,
 * storage, database). There is no business or platform service logic here.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    CacheModule,
    MessagingModule,
    // NotificationModule,
    // StorageModule,
    // ContextModule,
    // ObservabilityModule,
  ],
})
export class InfrastructureModule {}
