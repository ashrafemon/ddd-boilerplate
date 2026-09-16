import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { AuditModule } from './audit/audit.module';
import { BatchOperationModule } from './batch-operation/batch-operation.module';
import { CacheModule } from './cache/cache.module';
import { ConditionEngineModule } from './condition-engine/condition-engine.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { ContextModule } from './context/context.module';
import { EventsModule } from './events/events.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { ImportModule } from './import/import.module';
import { LockingModule } from './locking/locking.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationModule } from './notification/notification.module';
import { NumberingModule } from './numbering/numbering.module';
import { ObservabilityModule } from './observability/observability.module';
import { OutboxModule } from './outbox/outbox.module';
import { RecurringModule } from './recurring/recurring.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { StorageModule } from './storage/storage.module';
import { WebhookModule } from './webhook/webhook.module';

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
    StorageModule,
    ObservabilityModule,
    CacheModule,
    ContextModule,
    ConfigurationModule,
    AuditModule,
    NumberingModule,
    NotificationModule,
    ConditionEngineModule,
    LockingModule,
    IdempotencyModule,
    SchedulerModule,
    RecurringModule,
    BatchOperationModule,
    ImportModule,
    WebhookModule,
  ],
  exports: [
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
    ConditionEngineModule,
    LockingModule,
    IdempotencyModule,
    SchedulerModule,
    RecurringModule,
    BatchOperationModule,
    ImportModule,
    WebhookModule,
  ],
})
export class PlatformModule {}
