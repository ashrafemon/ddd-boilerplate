import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IN_PROCESS_EVENT_BUS } from '@shared-kernel/ports/event-bus.port';
import { AuditModule } from './audit/audit.module';
import { AUDIT } from './audit/ports/audit.port';
import { ConfigurationModule } from './configuration/configuration.module';
import { COMPANY_CONFIG } from './configuration/ports/company-config.port';
import { EventsModule } from './events/events.module';
import { MESSAGE_ROUTING_POLICY } from './events/message-routing.policy';
import { NotificationModule } from './notification/notification.module';
import { NOTIFICATION_DISPATCH } from './notification/ports/notification.port';
import { NumberingModule } from './numbering/numbering.module';
import { NUMBERING } from './numbering/ports/numbering.port';
import { OutboxModule } from './outbox/outbox.module';
import { OUTBOX_REPOSITORY } from './outbox/ports/outbox-repository.port';
import { OUTBOX_WRITER } from './outbox/ports/outbox-writer.port';

/**
 * Platform layer — cross-cutting support services for business modules.
 *
 * Each platform sub-system lives in its own folder with its own @Global
 * module and its ports under the owning folder (outbox, events, audit,
 * numbering, notification). This module is the global composition root: it
 * aggregates the sub-modules and re-exports their port tokens so business
 * modules depend only on ports and never touch infrastructure clients.
 * Transaction boundaries are handled with the @Transactional decorator +
 * TransactionHost provided by the infrastructure ContextModule.
 */
@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    OutboxModule,
    EventsModule,
    ConfigurationModule,
    AuditModule,
    NumberingModule,
    NotificationModule,
  ],
  exports: [
    OUTBOX_WRITER,
    OUTBOX_REPOSITORY,
    IN_PROCESS_EVENT_BUS,
    MESSAGE_ROUTING_POLICY,
    NUMBERING,
    AUDIT,
    NOTIFICATION_DISPATCH,
    COMPANY_CONFIG,
  ],
})
export class PlatformModule {}
