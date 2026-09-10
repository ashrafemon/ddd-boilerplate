# Scheduler (`platform/scheduler`)

Centralized TIME-trigger bookkeeping. Producers never touch `scheduled_jobs`;
they call inbound ports (or the legacy `SchedulerPort` facade).

## Layout

```
ports/         inbound (register, cancel, dispatch, reconcile, update, queries,
               SchedulerPort facade) + outbound (repositories, lock, event
               publisher, queue, fire handler)
usecases/      one class per inbound port (+ SchedulerPortFacade)
adapters/      Prisma repositories, BullMQ queue + @Processor worker,
               Redis lock, RabbitMQ event publisher
cron-calculator.ts, scheduled-job-handler.registry.ts, scheduled-job.processor.ts,
scheduler.ticker.ts, scheduler.types.ts, scheduler.errors.ts, scheduler.constants.ts
http/          admin controllers + Zod request DTOs
```

## Dispatch flow

1. Ticker → `DispatchDueJobsUseCase`
2. Postgres `FOR UPDATE SKIP LOCKED` claim → status `CLAIMED`
3. Redis lock (`scheduler:lock:{jobId}`) — **fail closed** if acquire fails
4. Enqueue via `@nestjs/bullmq` (`scheduler.jobs`, jobId = `idempotencyKey`) — handlers are **not** run inline
5. Dispatch log (idempotency key = dispatch log id). No outbox row.
6. `@Processor` worker runs `ScheduledJobProcessor`: registry handler, else RabbitMQ `scheduler.job.{jobType}`
7. Cron: recompute `nextRunAt`. External: producer must `reschedule` (handlers do this themselves)

## Open-decision defaults

| Topic | Default |
|-------|---------|
| Missed Cron | skip-to-next |
| Missed External | catch-up (leave due for next tick) |
| Cron edit | recompute `nextRunAt` immediately |
| Edit audit | module-local `scheduled_job_edit_log` |

## Ports

All scheduler ports live in `ports/` as **abstract classes used as their own DI token**
(this repo's port convention). Bindings happen in `scheduler.module.ts`
(`useExisting`); consumers inject the abstract class directly.
`SchedulerPort.schedule/reschedule/cancel/*ByAggregate` maps to AGGREGATE + EXTERNAL
register/reschedule/cancel — keeps orphaned Recurring compiling.

## Handler registration

Owning modules inject `ScheduledJobHandlerRegistry` (exported through `PlatformModule`)
and register their handler directly in `onApplicationBootstrap` — no `ModuleRef` lookup:

```ts
// platform/recurring/recurring.module.ts
onApplicationBootstrap(): void {
  this.scheduledJobHandlers.register('Recurring', this.generationHandler);
}
```

Registry is keyed by **jobType** (not aggregateType).
