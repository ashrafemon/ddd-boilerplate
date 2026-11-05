import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { AuditModule } from './platform-common/audit/audit.module';
import { AuthenticationModule } from './platform-common/authentication/authentication.module';
import { BatchOperationModule } from './platform-common/batch-operation/batch-operation.module';
import { CacheModule } from './platform-common/cache/cache.module';
import { ConditionEngineModule } from './platform-common/condition-engine/condition-engine.module';
import { ConfigurationModule } from './platform-organization/configuration/configuration.module';
import { ContextModule } from './platform-common/context/context.module';
import { EventsModule } from './platform-common/events/events.module';
import { IdempotencyModule } from './platform-common/idempotency/idempotency.module';
import { IdentityModule } from './platform-common/identity/identity.module';
import { ImportModule } from './platform-common/import/import.module';
import { LockingModule } from './platform-common/locking/locking.module';
import { MessagingModule } from './platform-common/messaging/messaging.module';
import { NotificationModule } from './platform-common/notification/notification.module';
import { NumberingModule } from './platform-common/numbering/numbering.module';
import { ObservabilityModule } from './platform-common/observability/observability.module';
import { RecurringModule } from './platform-common/recurring/recurring.module';
import { SagaModule } from './platform-organization/saga/saga.module';
import { AuthorizationModule } from './platform-organization/authorization/authorization.module';
import { SchedulerModule } from './platform-common/scheduler/scheduler.module';
import { StorageModule } from './platform-common/storage/storage.module';
import { WebhookModule } from './platform-common/webhook/webhook.module';
import { InboxModule } from '@infrastructure/inbox/inbox.module';
import { OutboxModule } from '@infrastructure/outbox/outbox.module';

/**
 * Platform composition root. Not global on purpose: a module that wants a
 * platform service must `imports: [PlatformModule]`, which keeps the
 * business → platform dependency visible in the module metadata.
 *
 * Opt-in aggregation: business handlers are PURE port data bridged onto their
 * platform registry by the composition root (batch =
 * `src/bootstrap/configure-batch-operations.ts`; vendor-import is the legacy
 * module-side shape, migrate on touch); recurring→scheduler is
 * platform→platform and stays module-side. See ARCHITECTURE.md §9.1.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    InfrastructureModule,
    OutboxModule,
    EventsModule,
    MessagingModule,
    InboxModule,
    StorageModule,
    ObservabilityModule,
    CacheModule,
    ContextModule,
    ConfigurationModule,
    AuthenticationModule,
    IdentityModule,
    AuthorizationModule,
    AuditModule,
    NumberingModule,
    NotificationModule,
    ConditionEngineModule,
    LockingModule,
    IdempotencyModule,
    SchedulerModule,
    SagaModule,
    RecurringModule,
    BatchOperationModule,
    ImportModule,
    WebhookModule,
  ],
  exports: [
    EventsModule,
    MessagingModule,
    InboxModule,
    OutboxModule,
    StorageModule,
    ObservabilityModule,
    CacheModule,
    ContextModule,
    ConfigurationModule,
    AuthenticationModule,
    IdentityModule,
    AuthorizationModule,
    AuditModule,
    NumberingModule,
    NotificationModule,
    ConditionEngineModule,
    LockingModule,
    IdempotencyModule,
    SchedulerModule,
    SagaModule,
    RecurringModule,
    BatchOperationModule,
    ImportModule,
    WebhookModule,
  ],
})
export class PlatformModule {}
