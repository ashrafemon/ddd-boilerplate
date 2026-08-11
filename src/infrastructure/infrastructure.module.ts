import { Global, Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { ContextModule } from './context/context.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { EventBusModule } from './event-bus/event-bus.module';
import { NotificationModule } from './notification/notification.module';
import { ObservabilityModule } from './observability/observability.module';
import { StorageModule } from './storage/storage.module';

/**
 * Infrastructure layer — only client adapters and their wiring modules.
 *
 * Each client implements a port defined by the platform layer (request
 * context, observability, event bus, cache, messaging, notification,
 * storage). There is no business or platform service logic here.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    CacheModule.forRoot(),
    NotificationModule,
    StorageModule,
    ContextModule,
    ObservabilityModule,
    EventBusModule,
  ],
})
export class InfrastructureModule {}
