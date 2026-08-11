import { Global, Module } from '@nestjs/common';
import { PlatformConfigurationModule } from './configuration/platform-configuration.module';
import { PlatformContextModule } from './context/context.module';
import { HealthModule } from './health/health.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { MessagingModule } from './messaging/messaging.module';
import { OrganizationModule } from './organization/organization.module';
import { OutboxModule } from './outbox/outbox.module';
import { SagaModule } from './saga/saga.module';
import { TenantModule } from './tenant/tenant.module';
import { WorkflowModule } from './workflow/workflow.module';

/**
 * Platform layer — cross-cutting services that manage the request context,
 * tenant/organization resolution and configuration, the transactional outbox,
 * messaging, idempotency, saga and workflow execution, and health checks.
 *
 * The platform defines the ports and does the work on top of the client
 * packages initialized by the infrastructure layer. It never contains
 * business logic.
 */
@Global()
@Module({
  imports: [
    PlatformContextModule,
    TenantModule,
    OrganizationModule,
    PlatformConfigurationModule,
    OutboxModule,
    IdempotencyModule,
    MessagingModule.forRoot(),
    SagaModule,
    WorkflowModule,
    HealthModule,
  ],
  exports: [
    PlatformContextModule,
    TenantModule,
    OrganizationModule,
    PlatformConfigurationModule,
    OutboxModule,
    IdempotencyModule,
    MessagingModule,
    SagaModule,
    WorkflowModule,
    HealthModule,
  ],
})
export class PlatformModule {}
