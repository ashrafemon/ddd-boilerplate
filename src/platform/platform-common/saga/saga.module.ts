import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { MessagingModule } from '@platform/platform-common/messaging/messaging.module';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { OutboxModule } from '@platform/platform-common/outbox/outbox.module';
import { SagaInboxModule } from '@platform/platform-common/saga-inbox/saga-inbox.module';
import { SagaOutboxModule } from '@platform/platform-common/saga-outbox/saga-outbox.module';
import { SagaInboundPort } from './ports/saga-inbound.port';
import { SagaRouterAdapter } from './adapters/saga-router.adapter';
import { CompanySettingsReader } from './ports/company-settings.port';
import { FeatureGate } from './ports/feature-gate.port';
import { SagaActionResolverPort } from './ports/saga-action.port';
import { EmptyCompanySettingsReader } from './adapters/empty-company-settings.reader';
import { EmptyFeatureGate } from './adapters/empty-feature-gate.adapter';
import { PrismaSagaDefinitionRepository } from './repositories/prisma-saga-definition.repository';
import { PrismaSagaInstanceRepository } from './repositories/prisma-saga-instance.repository';
import { PrismaSagaStepRepository } from './repositories/prisma-saga-step.repository';
import { SagaActionRegistry } from './adapters/saga-action.registry';
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
import { ValidateActiveSagaDefinitionsUseCase } from './use-cases/validate-active-saga-definitions.usecase';
import { StartSagaUseCase } from './use-cases/start-saga.usecase';
import { SagaStepWorkerService } from './services/saga-step-worker.service';
import { SagaSweepService } from './services/saga-sweep.service';
import { SagaDefinitionIntegrityService } from './services/saga-definition-integrity.service';
import { SagaBrokerConsumerService } from './services/saga-broker-consumer.service';
import { SagaCommandConsumerService } from './services/saga-command.consumer';
import { SagaStepResultConsumerService } from './services/saga-step-result.consumer';
import { SagaEventRouterService } from './services/saga-event-router.service';
import { SagaCommandPublisherPort, SagaStepResultPublisherPort } from './ports/saga-command.port';
import { MessagingSagaPublisher } from './adapters/messaging-saga.publisher';
import { SagaDefinitionController } from './http/saga-definition.controller';
import { ListSagaDefinitionsUseCase } from './use-cases/list-saga-definitions.usecase';
import { SetSagaDefinitionStatusUseCase } from './use-cases/set-saga-definition-status.usecase';
import { RunSagaStepCommandUseCase } from './use-cases/run-saga-step-command.usecase';
import { SettleSagaStepResultUseCase } from './use-cases/settle-saga-step-result.usecase';

/**
 * Platform Saga module — company-configurable cross-aggregate orchestration.
 *
 * NOT global. The runtime imports no business module: business work is declared
 * as `SagaAction` providers (registered under the `SAGA_ACTION` token and resolved
 * by `SagaActionRegistry`), gating through `FeatureGate`, settings through
 * `CompanySettingsReader`.
 *
 * Everything crosses the broker, nothing is called directly:
 *   events   broker → `SagaBrokerConsumerService` → `SagaInboundPort.accept`
 *   work     `ExecuteSagaStepUseCase` → `saga.command` → consumer → action
 *   results  consumer → `saga.step.result` → `SettleSagaStepResultUseCase`
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
  imports: [
    ContextModule,
    PrismaModule,
    OutboxModule,
    SagaOutboxModule,
    SagaInboxModule,
    // Broker transport for step commands/results (platform port, no broker client here)
    MessagingModule,
  ],
  providers: [
    // Outbound adapters → outbound ports
    PrismaSagaDefinitionRepository,
    PrismaSagaInstanceRepository,
    PrismaSagaStepRepository,
    SagaActionRegistry,
    { provide: SagaActionResolverPort, useExisting: SagaActionRegistry },

    // Broker transport for step work: command out, result back (EDA, no direct calls)
    // Runtime definition catalogue: publish, list, validate, retire
    SagaDefinitionController,
    ListSagaDefinitionsUseCase,
    SetSagaDefinitionStatusUseCase,

    MessagingSagaPublisher,
    { provide: SagaCommandPublisherPort, useExisting: MessagingSagaPublisher },
    { provide: SagaStepResultPublisherPort, useExisting: MessagingSagaPublisher },

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
    ValidateActiveSagaDefinitionsUseCase,
    SettleSagaStepResultUseCase,
    RunSagaStepCommandUseCase,

    // Boot-time definition integrity (flow 9: CONFIG_INVALID)
    SagaDefinitionIntegrityService,

    // Event edge: broker → SagaInboundPort.accept (triggers, WAIT events, cancels)
    SagaBrokerConsumerService,
    SagaEventRouterService,

    // Work edge: saga.command → action → saga.step.result (nothing runs in-process)
    SagaCommandConsumerService,
    SagaStepResultConsumerService,
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
