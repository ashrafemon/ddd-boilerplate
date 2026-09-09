import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { AuditModule } from './audit/audit.module';
import { AuditPort } from './audit/ports/audit.port';
import { CacheModule } from './cache/cache.module';
import { CachePort } from './cache/ports/cache.port';
import { ConfigurationModule } from './configuration/configuration.module';
import { CompanyConfigPort } from './configuration/ports/company-config.port';
import { ContextModule } from './context/context.module';
import { RequestContextPort } from './context/ports/request-context.port';
import { ModulePortResolver } from './context/ports/module-port-resolver.port';
import { EventsModule } from './events/events.module';
import { MessageRoutingPolicy } from './events/message-routing.policy';
import { MessagingModule } from './messaging/messaging.module';
import { MessagePublisher } from './messaging/ports/message-publisher.port';
import { NotificationModule } from './notification/notification.module';
import { NotificationDispatchPort } from './notification/ports/notification.port';
import { NumberingModule } from './numbering/numbering.module';
import { NumberingPort } from './numbering/ports/numbering.port';
import { ObservabilityModule } from './observability/observability.module';
import { ErrorTrackingPort } from './observability/ports/error-tracking.port';
import { LoggerPort } from './observability/ports/logger.port';
import { MetricsPort } from './observability/ports/metrics.port';
import { OutboxModule } from './outbox/outbox.module';
import { OutboxWriterPort } from './outbox/ports/outbox-writer.port';
import { StorageModule } from './storage/storage.module';
import { FileStoragePort } from './storage/ports/file-storage.port';

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
    ConfigurationModule,
    AuditModule,
    NumberingModule,
    NotificationModule,
  ],
  exports: [
    OutboxWriterPort,
    MessagePublisher,
    MessageRoutingPolicy,
    FileStoragePort,
    LoggerPort,
    MetricsPort,
    ErrorTrackingPort,
    CachePort,
    RequestContextPort,
    ModulePortResolver,
    NumberingPort,
    AuditPort,
    NotificationDispatchPort,
    CompanyConfigPort,
  ],
})
export class PlatformModule {}
