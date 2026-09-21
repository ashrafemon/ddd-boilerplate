import { Module } from '@nestjs/common';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { ContextModule } from '../context/context.module';
import { SagaPort } from './ports/saga.port';
import { SagaRepositoryPort } from './ports/saga-repository.port';
import { PrismaSagaRepository } from './repositories/prisma-saga.repository';
import { SagaDefinitionRegistry } from './definitions/saga-definition';
import { StartSagaUseCase } from './usecases/start-saga.usecase';
import { HandleSagaEventUseCase } from './usecases/handle-saga-event.usecase';
import { SuspendSagaUseCase } from './usecases/suspend-saga.usecase';
import { CompensateSagaUseCase } from './usecases/compensate-saga.usecase';
import { SagaService } from './saga.service';
import { SagaReconciler } from './reconciliation/saga-reconciliation';

/**
 * Platform Saga module — configurable process orchestration.
 *
 * This module is NOT global. Business modules must import PlatformModule.
 * Saga never imports business modules — it communicates through ports only.
 */
@Module({
  imports: [ContextModule, PrismaModule],
  providers: [
    // Repository — PostgreSQL saga persistence
    PrismaSagaRepository,
    { provide: SagaRepositoryPort, useExisting: PrismaSagaRepository },

    // Definition registry — in-memory, populated at bootstrap
    SagaDefinitionRegistry,

    // Use cases — one per file
    StartSagaUseCase,
    HandleSagaEventUseCase,
    SuspendSagaUseCase,
    CompensateSagaUseCase,

    // Facade → public port
    SagaService,
    { provide: SagaPort, useExisting: SagaService },

    // Reconciliation
    SagaReconciler,
  ],
  exports: [SagaPort, SagaDefinitionRegistry],
})
export class SagaModule {}
