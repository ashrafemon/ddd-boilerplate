import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { OutboxModule } from '@platform/platform-common/outbox/outbox.module';
import { SagaInboxModule } from '@platform/platform-common/saga-inbox/saga-inbox.module';
import { SagaOutboxModule } from '@platform/platform-common/saga-outbox/saga-outbox.module';
import { SagaInboundPort } from './inbound/ports/saga-inbound.port';
import { SagaRouterAdapter } from './inbound/adapters/saga-router.adapter';
import { CompanySettingsReader } from './outbound/ports/company-settings.port';
import { FeatureGate } from './outbound/ports/feature-gate.port';
import { SagaActionResolverPort } from './outbound/ports/saga-action.port';
import { SagaDefinitionRepositoryPort } from './outbound/ports/saga-definition.repository.port';
import { SagaInstanceRepositoryPort } from './outbound/ports/saga-instance.repository.port';
import { SagaStepRepositoryPort } from './outbound/ports/saga-step.repository.port';
import { EmptyCompanySettingsReader } from './outbound/adapters/empty-company-settings.reader';
import { EmptyFeatureGate } from './outbound/adapters/empty-feature-gate.adapter';
import { PrismaSagaDefinitionRepository } from './outbound/adapters/prisma-saga-definition.repository';
import { PrismaSagaInstanceRepository } from './outbound/adapters/prisma-saga-instance.repository';
import { PrismaSagaStepRepository } from './outbound/adapters/prisma-saga-step.repository';
import { SagaActionRegistry } from './outbound/adapters/saga-action.registry';
import { AcceptSagaEventUseCase } from './use-cases/accept-saga-event.usecase';
import { AdvanceSagaUseCase } from './use-cases/advance-saga.usecase';
import { BufferSagaEventUseCase } from './use-cases/buffer-saga-event.usecase';
import { BuildSagaPlanUseCase } from './use-cases/build-saga-plan.usecase';
import { CancelSagaUseCase } from './use-cases/cancel-saga.usecase';
import { CompleteSagaUseCase } from './use-cases/complete-saga.usecase';
import { ExecuteSagaStepUseCase } from './use-cases/execute-saga-step.usecase';
import { ExpireWaitStepUseCase } from './use-cases/expire-wait-step.usecase';
import { SettleStepFailureUseCase } from './use-cases/settle-step-failure.usecase';
import { SettleStepSuccessUseCase } from './use-cases/settle-step-success.usecase';
import { StartCompensationUseCase } from './use-cases/start-compensation.usecase';
import { RegisterSagaDefinitionUseCase } from './use-cases/register-saga-definition.usecase';
import { StartSagaUseCase } from './use-cases/start-saga.usecase';
import { SagaStepWorkerService } from './services/saga-step-worker.service';
import { SagaSweepService } from './services/saga-sweep.service';

/**
 * Platform Saga module — company-configurable cross-aggregate orchestration.
 *
 * NOT global. The runtime imports no business module: business work arrives
 * through `SagaAction` providers (registered under the `SAGA_ACTION` token and
 * resolved by `SagaActionRegistry`), gating through `FeatureGate`, settings
 * through `CompanySettingsReader`. Events arrive through `SagaInboundPort`.
 *
 * Bindings are ports → adapters; use cases inject ports only. `SagaActionRegistry`
 * is exported as the extension seam business modules register into.
 *
 * Persistence lives in two sibling modules this one depends on and never
 * re-exports: `SagaOutboxModule` (the `saga_outbox` ledger + its dispatcher) and
 * `SagaInboxModule` (the `saga_inbox` dedupe/buffer ledger + retention). The
 * engine talks to them only through `SagaOutboxWriterPort` and `SagaInboxPort`.
 */
@Module({
  imports: [ContextModule, PrismaModule, OutboxModule, SagaOutboxModule, SagaInboxModule],
  providers: [
    // Outbound adapters → outbound ports
    PrismaSagaDefinitionRepository,
    { provide: SagaDefinitionRepositoryPort, useExisting: PrismaSagaDefinitionRepository },
    PrismaSagaInstanceRepository,
    { provide: SagaInstanceRepositoryPort, useExisting: PrismaSagaInstanceRepository },
    PrismaSagaStepRepository,
    { provide: SagaStepRepositoryPort, useExisting: PrismaSagaStepRepository },
    SagaActionRegistry,
    { provide: SagaActionResolverPort, useExisting: SagaActionRegistry },

    // Gating + settings — owned outside the saga; empty (fail-closed) defaults.
    { provide: FeatureGate, useClass: EmptyFeatureGate },
    { provide: CompanySettingsReader, useClass: EmptyCompanySettingsReader },

    // Use cases
    BuildSagaPlanUseCase,
    CompleteSagaUseCase,
    AdvanceSagaUseCase,
    StartCompensationUseCase,
    CancelSagaUseCase,
    SettleStepSuccessUseCase,
    SettleStepFailureUseCase,
    StartSagaUseCase,
    RegisterSagaDefinitionUseCase,
    ExecuteSagaStepUseCase,
    ExpireWaitStepUseCase,
    BufferSagaEventUseCase,
    AcceptSagaEventUseCase,

    // Scheduled orchestration
    SagaStepWorkerService,
    SagaSweepService,

    // Inbound port implementations
    SagaRouterAdapter,
    { provide: SagaInboundPort, useExisting: SagaRouterAdapter },
  ],
  exports: [SagaInboundPort, SagaActionRegistry],
})
export class SagaModule {}
