# Scheduler (`platform/scheduler`)

Centralized TIME-trigger bookkeeping. Producers never touch `scheduled_jobs`;
they call inbound ports (dispatch, reconcile, update, queries, or the
aggregate-scoped `SchedulerPort`).

## Layout

```
ports/         inbound (dispatch, reconcile, update, queries, SchedulerPort) +
               outbound (repositories, event publisher, queue, fire handler;
               the Redis lock lives in @platform/locking)
usecases/      business logic only, one class per capability — implements no port
adapters/      inbound port adapters (delegate to usecases) + Prisma repositories,
               BullMQ queue + @Processor worker, RabbitMQ event publisher
cron-calculator.ts, scheduled-job-handler.registry.ts, scheduled-job.processor.ts,
scheduler.ticker.ts, scheduler.types.ts, scheduler.errors.ts, scheduler.constants.ts
http/          admin controllers + Zod request DTOs
```

## Dispatch flow

1. Ticker → `DispatchDueJobsUseCase`
2. Postgres `FOR UPDATE SKIP LOCKED` claim → status `CLAIMED`
3. `DistributedLockPort` lease per job (`platform/locking`, Redis key
   `platform:lock:{jobId}`, owner-token ticket) — **fail closed**: no ticket ⇒
   row stays CLAIMED for reconciliation
4. Enqueue via `@nestjs/bullmq` (`scheduler.jobs`, jobId = `idempotencyKey`) — handlers are **not** run inline
5. Dispatch log upsert keyed by `sha256(jobId:slot)` — the same value is used
   as the BullMQ jobId, so crash-re-fires of one slot dedupe. No outbox row.
6. `@Processor` worker runs `ScheduledJobProcessor`: registry handler, else RabbitMQ `scheduler.job.{jobType}`
7. Cron: recompute `nextRunAt`. External: producer must `reschedule` (handlers do this themselves)

## Open-decision defaults

| Topic           | Default                               |
| --------------- | ------------------------------------- |
| Missed Cron     | skip-to-next                          |
| Missed External | catch-up (leave due for next tick)    |
| Cron edit       | recompute `nextRunAt` immediately     |
| Edit audit      | module-local `scheduled_job_edit_log` |

## Ports

All scheduler ports live in `ports/` as **abstract classes used as their own DI token**
(this repo's port convention). Each is implemented by a thin adapter in `adapters/`
that delegates to the matching usecase; bindings happen in `scheduler.module.ts`
(`useExisting: <Adapter>`), and consumers inject the abstract class directly.
`SchedulerPort` is the single aggregate-scoped surface (`schedule/reschedule/cancel/
*ByAggregate`) — implemented by `SchedulerAdapter`, which maps `schedule` to
AGGREGATE + EXTERNAL register and delegates cancel/reschedule to the matching
usecases. `RegisterScheduledJobUseCase`, `CancelScheduledJobUseCase`, and
`RescheduleExternalJobUseCase` have no port of their own — `SchedulerPort` is
their only inbound surface — so business code (e.g. Recurring) depends on
`SchedulerPort`, not on those usecases or their granular ports directly.

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

## Failure semantics

Transient handler/dispatch failures back off (`retryCount`, exponential on
`nextRunAt`) and the schedule returns to `PENDING`; after
`SCHEDULER_MAX_RETRIES` the row parks as `SUSPENDED` and the dispatch log row
flips to `DEAD_LETTERED`. Cancel/suspend are authoritative: in-flight
executions check state before firing, terminal writes are guarded so a
settled schedule is never resurrected.

## Who calls it / how called

| Caller | Surfaces used |
| --- | --- |
| `platform/recurring` | `SchedulerPort` (register/reschedule/cancel by aggregate) + registers the `Recurring` jobType handler at bootstrap |
| business modules (via their platform adapters) | `SchedulerPort` only — never repositories |
| ops | HTTP `/api/v1/scheduled-jobs` (+ `/scheduler/health` ticker heartbeat) |
| `@nestjs/schedule` `SchedulerTicker` | `DispatchDueJobsUseCase` / `ReconcileMissedJobsUseCase` on intervals |

## Tenancy & rules
- `tenantId` is stamped at register time, filtered into claims only via the
  dispatch payload, and restored into CLS by the worker before handlers run.
- `TENANCY_MODE=multi` ⇒ jobType handlers must treat `payload.tenantId` as
  authenticated and pass it to repository writes.
- Background executions must not read a raw HTTP header — everything comes
  from the `scheduled_jobs` row + payload.
