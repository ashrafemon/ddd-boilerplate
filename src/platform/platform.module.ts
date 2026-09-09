import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './audit/audit.module';
import { CacheModule } from './cache/cache.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { ContextModule } from './context/context.module';
import { EventsModule } from './events/events.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationModule } from './notification/notification.module';
import { NumberingModule } from './numbering/numbering.module';
import { ObservabilityModule } from './observability/observability.module';
import { OutboxModule } from './outbox/outbox.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    OutboxModule,
    EventsModule,
    MessagingModule,
    StorageModule,
    ObservabilityModule,
    CacheModule,
    ContextModule,
    ConfigurationModule,
    AuditModule,
    NumberingModule,
    NotificationModule,
  ],
  exports: [],
})
export class PlatformModule {}
