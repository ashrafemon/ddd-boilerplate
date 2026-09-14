import { INFRA_CACHE_MODULE } from '@infrastructure/cache/cache.module';
import { MessagingModule } from '@platform/messaging/messaging.module';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScheduledJobHandlerRegistry } from './scheduled-job-handler.registry';
import { ScheduledJobProcessor } from './scheduled-job.processor';
import { SchedulerTicker } from './scheduler.ticker';
import { DispatchDueJobsPort } from './ports/dispatch-due-jobs.port';
import { GetScheduledJobStatusPort } from './ports/get-scheduled-job-status.port';
import { GetSchedulerHealthMetricsPort } from './ports/get-scheduler-health-metrics.port';
import { ListScheduledJobDispatchLogPort } from './ports/list-scheduled-job-dispatch-log.port';
import { ReconcileMissedJobsPort } from './ports/reconcile-missed-jobs.port';
import { SchedulerPort } from './ports/scheduler.port';
import { UpdateScheduledJobPort } from './ports/update-scheduled-job.port';
import { DistributedLockPort } from './ports/distributed-lock.port';
import { ScheduledJobDispatchLogRepositoryPort } from './ports/scheduled-job-dispatch-log-repository.port';
import { ScheduledJobEditLogRepositoryPort } from './ports/scheduled-job-edit-log-repository.port';
import { ScheduledJobRepositoryPort } from './ports/scheduled-job-repository.port';
import { SchedulerEventPublisherPort } from './ports/scheduler-event-publisher.port';
import { SchedulerJobQueuePort } from './ports/scheduler-job-queue.port';
import { CancelScheduledJobUseCase } from './usecases/cancel-scheduled-job.usecase';
import { DispatchDueJobsUseCase } from './usecases/dispatch-due-jobs.usecase';
import { GetScheduledJobStatusUseCase } from './usecases/get-scheduled-job-status.usecase';
import { GetSchedulerHealthMetricsUseCase } from './usecases/get-scheduler-health-metrics.usecase';
import { ListScheduledJobDispatchLogUseCase } from './usecases/list-scheduled-job-dispatch-log.usecase';
import { ReconcileMissedJobsUseCase } from './usecases/reconcile-missed-jobs.usecase';
import { RegisterScheduledJobUseCase } from './usecases/register-scheduled-job.usecase';
import { RescheduleExternalJobUseCase } from './usecases/reschedule-external-job.usecase';
import { UpdateScheduledJobUseCase } from './usecases/update-scheduled-job.usecase';
import { PrismaScheduledJobDispatchLogRepository } from './repositories/prisma-scheduled-job-dispatch-log.repository';
import { PrismaScheduledJobEditLogRepository } from './repositories/prisma-scheduled-job-edit-log.repository';
import { PrismaScheduledJobRepository } from './repositories/prisma-scheduled-job.repository';
import { SCHEDULER_QUEUE_NAME } from './scheduler.constants';
import { BullMqSchedulerQueueAdapter } from './adapters/bullmq-scheduler-queue.adapter';
import { BullMqSchedulerJobWorker } from './adapters/bullmq-scheduler-job.worker';
import { RabbitMqSchedulerEventPublisher } from './adapters/rabbitmq-scheduler-event.publisher';
import { RedisDistributedLockAdapter } from './adapters/redis-distributed-lock.adapter';
import { SchedulerAdapter } from './adapters/scheduler.adapter';
import { DispatchDueJobsAdapter } from './adapters/dispatch-due-jobs.adapter';
import { GetScheduledJobStatusAdapter } from './adapters/get-scheduled-job-status.adapter';
import { GetSchedulerHealthMetricsAdapter } from './adapters/get-scheduler-health-metrics.adapter';
import { ListScheduledJobDispatchLogAdapter } from './adapters/list-scheduled-job-dispatch-log.adapter';
import { ReconcileMissedJobsAdapter } from './adapters/reconcile-missed-jobs.adapter';
import { UpdateScheduledJobAdapter } from './adapters/update-scheduled-job.adapter';
import { SchedulerController, SchedulerHealthController } from './http/scheduler.controller';

/**
 * Platform scheduler — DB-backed job table polled by SchedulerTicker, async
 * execution through BullMQ, Redis locks, and per-jobType fire handlers
 * registered opt-in on ScheduledJobHandlerRegistry by the owning module. Business code
 * injects the inbound port abstract classes only.
 */
@Module({
  imports: [
    INFRA_CACHE_MODULE,
    MessagingModule,
    BullModule.registerQueue({ name: SCHEDULER_QUEUE_NAME }),
  ],
  controllers: [SchedulerController, SchedulerHealthController],
  providers: [
    // outbound adapters
    ScheduledJobHandlerRegistry,
    PrismaScheduledJobRepository,
    { provide: ScheduledJobRepositoryPort, useExisting: PrismaScheduledJobRepository },
    PrismaScheduledJobDispatchLogRepository,
    {
      provide: ScheduledJobDispatchLogRepositoryPort,
      useExisting: PrismaScheduledJobDispatchLogRepository,
    },
    PrismaScheduledJobEditLogRepository,
    {
      provide: ScheduledJobEditLogRepositoryPort,
      useExisting: PrismaScheduledJobEditLogRepository,
    },
    RedisDistributedLockAdapter,
    { provide: DistributedLockPort, useExisting: RedisDistributedLockAdapter },
    RabbitMqSchedulerEventPublisher,
    { provide: SchedulerEventPublisherPort, useExisting: RabbitMqSchedulerEventPublisher },
    ScheduledJobProcessor,
    BullMqSchedulerQueueAdapter,
    { provide: SchedulerJobQueuePort, useExisting: BullMqSchedulerQueueAdapter },
    BullMqSchedulerJobWorker,

    // use cases (business logic only) bound to their inbound ports via a thin adapter
    RegisterScheduledJobUseCase,
    CancelScheduledJobUseCase,
    RescheduleExternalJobUseCase,
    UpdateScheduledJobUseCase,
    UpdateScheduledJobAdapter,
    { provide: UpdateScheduledJobPort, useExisting: UpdateScheduledJobAdapter },
    DispatchDueJobsUseCase,
    DispatchDueJobsAdapter,
    { provide: DispatchDueJobsPort, useExisting: DispatchDueJobsAdapter },
    ReconcileMissedJobsUseCase,
    ReconcileMissedJobsAdapter,
    { provide: ReconcileMissedJobsPort, useExisting: ReconcileMissedJobsAdapter },
    GetScheduledJobStatusUseCase,
    GetScheduledJobStatusAdapter,
    { provide: GetScheduledJobStatusPort, useExisting: GetScheduledJobStatusAdapter },
    ListScheduledJobDispatchLogUseCase,
    ListScheduledJobDispatchLogAdapter,
    {
      provide: ListScheduledJobDispatchLogPort,
      useExisting: ListScheduledJobDispatchLogAdapter,
    },
    GetSchedulerHealthMetricsUseCase,
    GetSchedulerHealthMetricsAdapter,
    {
      provide: GetSchedulerHealthMetricsPort,
      useExisting: GetSchedulerHealthMetricsAdapter,
    },
    SchedulerAdapter,
    { provide: SchedulerPort, useExisting: SchedulerAdapter },
    SchedulerTicker,
  ],
  exports: [
    SchedulerPort,
    UpdateScheduledJobPort,
    DispatchDueJobsPort,
    ReconcileMissedJobsPort,
    GetScheduledJobStatusPort,
    ListScheduledJobDispatchLogPort,
    GetSchedulerHealthMetricsPort,
    ScheduledJobHandlerRegistry,
  ],
})
export class SchedulerModule {}
