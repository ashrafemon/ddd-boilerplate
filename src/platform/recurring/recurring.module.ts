import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConditionEngineModule } from '@platform/condition-engine/condition-engine.module';
import { ContextModule } from '@platform/context/context.module';
import { OutboxModule } from '@platform/outbox/outbox.module';
import { ScheduledJobHandlerRegistry } from '@platform/scheduler/scheduled-job-handler.registry';
import { SchedulerModule } from '@platform/scheduler/scheduler.module';
import { DomainEventDispatcher } from './domain-event.dispatcher';
import { RecurringGenerationHandler } from './recurring-generation.handler';
import { RecurringExecutionPort } from './ports/recurring-execution.port';
import { RecurringTemplatePort } from './ports/recurring-template.port';
import { RecurringExecutionRepositoryPort } from './ports/recurring-execution-repository.port';
import { RecurringTemplateRepositoryPort } from './ports/recurring-template-repository.port';
import { CancelRecurringTemplateUseCase } from './usecases/cancel-recurring-template.usecase';
import { CreateRecurringTemplateUseCase } from './usecases/create-recurring-template.usecase';
import { GetRecurringTemplateUseCase } from './usecases/get-recurring-template.usecase';
import { ListRecurringTemplatesUseCase } from './usecases/list-recurring-templates.usecase';
import { PauseRecurringTemplateUseCase } from './usecases/pause-recurring-template.usecase';
import { RecurringExecutionAdapter } from './adapters/recurring-execution.adapter';
import { RecurringTemplateAdapter } from './adapters/recurring-template.adapter';
import { ResumeRecurringTemplateUseCase } from './usecases/resume-recurring-template.usecase';
import { PrismaRecurringExecutionRepository } from './repositories/prisma-recurring-execution.repository';
import { PrismaRecurringTemplateRepository } from './repositories/prisma-recurring-template.repository';
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
    RecurringExecutionAdapter,
    { provide: RecurringExecutionPort, useExisting: RecurringExecutionAdapter },
    RecurringTemplateAdapter,
    { provide: RecurringTemplatePort, useExisting: RecurringTemplateAdapter },
    DomainEventDispatcher,
    CreateRecurringTemplateUseCase,
    PauseRecurringTemplateUseCase,
    ResumeRecurringTemplateUseCase,
    CancelRecurringTemplateUseCase,
    GetRecurringTemplateUseCase,
    ListRecurringTemplatesUseCase,
  ],
  exports: [RecurringExecutionPort, RecurringTemplatePort],
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
