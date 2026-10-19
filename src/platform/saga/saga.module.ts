import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { ContextModule } from '../context/context.module';
import { OutboxModule } from '../outbox/outbox.module';
import { EmptyCompanySettingsReader } from './adapters/empty-company-settings.reader';
import { EmptyFeatureGate } from './adapters/empty-feature-gate.adapter';
import { PlanBuilder } from './application/plan-builder';
import { SagaActionRegistry } from './application/saga-action.registry';
import { SagaEngine } from './application/saga-engine';
import { SagaRouter } from './application/saga-router';
import { CompanySettingsReader } from './ports/company-settings.port';
import { FeatureGate } from './ports/feature-gate.port';
import { SagaInboundPort } from './ports/saga-inbound.port';
import {
  SagaCompanyConfigRepository,
  SagaDefinitionRepository,
  SagaInboxRepository,
  SagaInstanceRepository,
  SagaStepRepository,
} from './repositories/prisma-saga.repository';
import { SagaScheduler } from './saga.scheduler';
import { SagaStepWorker } from './workers/step-worker';

/**
 * Platform Saga module — company-configurable cross-aggregate orchestration.
 *
 * NOT global. The saga imports no business module: business work arrives through
 * `SagaAction` providers (registered under the `SAGA_ACTION` token into
 * `SagaActionRegistry`), gating through `FeatureGate`, settings through
 * `CompanySettingsReader`. Events arrive through `SagaInboundPort`.
 */
@Module({
  imports: [ContextModule, PrismaModule, OutboxModule],
  providers: [
    // Repositories — one class per table.
    SagaDefinitionRepository,
    SagaCompanyConfigRepository,
    SagaInstanceRepository,
    SagaStepRepository,
    SagaInboxRepository,

    // Application — plan builder, state machine, router (inbound port).
    PlanBuilder,
    SagaEngine,
    SagaRouter,
    { provide: SagaInboundPort, useExisting: SagaRouter },

    // Actions — populated by the composition root / business modules.
    SagaActionRegistry,

    // Gating + settings — owned outside the saga; empty (fail-closed) defaults.
    { provide: FeatureGate, useClass: EmptyFeatureGate },
    { provide: CompanySettingsReader, useClass: EmptyCompanySettingsReader },

    // Worker + scheduler — durable step execution and sweeps.
    SagaStepWorker,
    SagaScheduler,
  ],
  exports: [SagaInboundPort, SagaActionRegistry],
})
export class SagaModule {}
