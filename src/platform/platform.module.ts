import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { AuditModule } from './audit/audit.module';
import { CacheModule } from './cache/cache.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { ContextModule } from './context/context.module';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationModule } from './notification/notification.module';
import { NumberingModule } from './numbering/numbering.module';
import { ObservabilityModule } from './observability/observability.module';
import { OutboxModule } from './outbox/outbox.module';
import { StorageModule } from './storage/storage.module';

/**
 * Platform composition root. Not global on purpose: a module that wants a
 * platform service must `imports: [PlatformModule]`, which keeps the
 * business → platform dependency visible in the module metadata.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    InfrastructureModule,
    OutboxModule,
    EventsModule,
    MessagingModule,
    StorageModule,
    ObservabilityModule,
    CacheModule,
    ContextModule,
    DatabaseModule,
    ConfigurationModule,
    AuditModule,
    NumberingModule,
    NotificationModule,
  ],
  exports: [
    OutboxModule,
    EventsModule,
    MessagingModule,
    StorageModule,
    ObservabilityModule,
    CacheModule,
    ContextModule,
    DatabaseModule,
    ConfigurationModule,
    AuditModule,
    NumberingModule,
    NotificationModule,
  ],
})
export class PlatformModule {}
