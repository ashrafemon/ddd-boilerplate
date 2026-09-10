import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConditionEngineModule } from '@platform/condition-engine/condition-engine.module';
import { ContextModule } from '@platform/context/context.module';
import { OutboxModule } from '@platform/outbox/outbox.module';
import { ScheduledJobHandlerRegistry } from '@platform/scheduler/scheduled-job-handler.registry';
import { SchedulerModule } from '@platform/scheduler/scheduler.module';
import { DomainEventDispatcher } from './domain-event.dispatcher';
import { RecurringGenerationHandler } from './recurring-generation.handler';
import { RecurringGeneratorRegistry } from './recurring-generator.registry';
import { RecurringExecutionPort } from './ports/recurring-execution.port';
import { RecurringExecutionRepositoryPort } from './ports/recurring-execution-repository.port';
import { RecurringTemplateRepositoryPort } from './ports/recurring-template-repository.port';
import { CancelRecurringTemplateUseCase } from './usecases/cancel-recurring-template.usecase';
import { CreateRecurringTemplateUseCase } from './usecases/create-recurring-template.usecase';
import { GetRecurringTemplateUseCase } from './usecases/get-recurring-template.usecase';
import { ListRecurringTemplatesUseCase } from './usecases/list-recurring-templates.usecase';
import { PauseRecurringTemplateUseCase } from './usecases/pause-recurring-template.usecase';
import { RecurringExecutionFacade } from './usecases/recurring-execution.facade';
import { ResumeRecurringTemplateUseCase } from './usecases/resume-recurring-template.usecase';
import { PrismaRecurringExecutionRepository } from './adapters/prisma-recurring-execution.repository';
import { PrismaRecurringTemplateRepository } from './adapters/prisma-recurring-template.repository';
import { RecurringTemplateController } from './http/recurring-template.controller';
import './events/recurring.registry';

/**
 * Platform recurring — TIME + EVENT triggered document generation.
 * Plugs into the scheduler by registering RecurringGenerationHandler for the
 * 'Recurring' jobType on the ScheduledJobHandlerRegistry at bootstrap;
 * business generators register themselves the same direct way.
 */
@Module({
  imports: [ContextModule, OutboxModule, SchedulerModule, ConditionEngineModule],
  controllers: [RecurringTemplateController],
  providers: [
    RecurringGeneratorRegistry,
    PrismaRecurringTemplateRepository,
    {
      provide: RecurringTemplateRepositoryPort,
      useExisting: PrismaRecurringTemplateRepository,
    },
    PrismaRecurringExecutionRepository,
    {
      provide: RecurringExecutionRepositoryPort,
      useExisting: PrismaRecurringExecutionRepository,
    },
    RecurringGenerationHandler,
    RecurringExecutionFacade,
    { provide: RecurringExecutionPort, useExisting: RecurringExecutionFacade },
    DomainEventDispatcher,
    CreateRecurringTemplateUseCase,
    PauseRecurringTemplateUseCase,
    ResumeRecurringTemplateUseCase,
    CancelRecurringTemplateUseCase,
    GetRecurringTemplateUseCase,
    ListRecurringTemplatesUseCase,
  ],
  exports: [RecurringGeneratorRegistry, RecurringExecutionPort, CreateRecurringTemplateUseCase],
})
export class RecurringModule implements OnApplicationBootstrap {
  constructor(
    private readonly scheduledJobHandlers: ScheduledJobHandlerRegistry,
    private readonly generationHandler: RecurringGenerationHandler,
  ) {}

  onApplicationBootstrap(): void {
    this.scheduledJobHandlers.register('Recurring', this.generationHandler);
  }
}
