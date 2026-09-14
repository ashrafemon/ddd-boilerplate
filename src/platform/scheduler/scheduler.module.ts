import { INFRA_CACHE_MODULE } from '@infrastructure/cache/cache.module';
import { ContextModule } from '@platform/context/context.module';
import { MessagingModule } from '@platform/messaging/messaging.module';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScheduledJobHandlerRegistry } from './scheduled-job-handler.registry';
import { ScheduledJobProcessor } from './scheduled-job.processor';
import { SchedulerTicker } from './scheduler.ticker';
import { SchedulerTickHeartbeat } from './scheduler-tick.heartbeat';
import { SchedulerPort } from './ports/scheduler.port';
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
import { SchedulerController, SchedulerHealthController } from './http/scheduler.controller';

/**
 * Platform scheduler — durable job timing for the whole monolith.
 *
 * Tables owned: scheduled_jobs, scheduled_job_dispatch_log, scheduled_job_edit_log.
 *
 * Lifecycle (numbered flow):
 *  1. Register  — services/business call SchedulerPort.schedule(...) (or the
 *     update/dispatch ops ports; thin adapters delegate to use cases).
 *  2. Poll      — SchedulerTicker (interval, SCHEDULER_POLL_INTERVAL_MS) runs
 *     DispatchDueJobsUseCase: claimDue (FOR UPDATE SKIP LOCKED) -> Redis
 *     distributed lock -> enqueue BullMQ job (idempotencyKey as BullMQ jobId).
 *  3. Execute   — BullMqSchedulerJobWorker -> ScheduledJobProcessor:
 *     registered jobType handler fires in-process, otherwise the job is
 *     published to RabbitMQ as scheduler.job.<jobType> for external consumers.
 *  4. Reschedule— CRON jobs compute nextRunAt via CronCalculator; EXTERNAL jobs
 *     stay claimed until the owner calls rescheduleExternal.
 *  5. Reconcile — ReconcileMissedJobsUseCase releases stale claims and applies
 *     missed-fire policy; edit log + dispatch log audit every change.
 *  Ops    — /scheduled-jobs (paged, tenant-scoped), PATCH (optimistic version),
 *     cancel, and POST :id/dispatch-now to force a job due-now for backfills.
 *
 * Inbound surface: SchedulerPort (cross-module facade), ops ports bound through
 * thin adapters; ScheduledJobHandlerRegistry is the plugin boundary business
 * modules register into from onApplicationBootstrap. Reads are tenant-scoped.
 */
@Module({
  imports: [
    ContextModule,
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

    // use cases — internal consumers (ticker/controller/adapter) inject them directly
    RegisterScheduledJobUseCase,
    CancelScheduledJobUseCase,
    RescheduleExternalJobUseCase,
    UpdateScheduledJobUseCase,
    DispatchDueJobsUseCase,
    ReconcileMissedJobsUseCase,
    GetScheduledJobStatusUseCase,
    ListScheduledJobDispatchLogUseCase,
    GetSchedulerHealthMetricsUseCase,
    SchedulerAdapter,
    { provide: SchedulerPort, useExisting: SchedulerAdapter },
    SchedulerTicker,
    SchedulerTickHeartbeat,
  ],
  exports: [SchedulerPort, ScheduledJobHandlerRegistry],
})
export class SchedulerModule {}
