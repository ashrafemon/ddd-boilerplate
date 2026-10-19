# platform/saga — Company-Configurable Orchestration

> Long-running cross-aggregate processes that run on ERP-standard defaults and
> that every company narrows at runtime with its own overlay. Defaults are found
> by event name + version; overlays only narrow, never widen. A saga calls
> business **actions** — never repositories — so it owns no billing, plans or
> subscriptions, only feature keys + settings + company overlays.

## What it does

1. **Plan build** (`PlanBuilder`) — merges the ACTIVE platform default with the
   company overlay: conditions are AND-combined, timing/retry overridden,
   optional steps switched on, standard steps switched off. A `requires` key the
   company lacks removes the step (or, for a `required` step, the whole saga).
   An empty plan means no instance is created.
2. **Route** (`SagaRouter`, the `SagaInboundPort`) — the only place a saga (or a
   wait) starts. Five checks in order: `requires`+policy → overlay → `if` →
   `when` → `match`. Events for its own emissions (`aggregateType = 'Saga'`) are
   dropped as a loop guard.
3. **Advance** (`SagaEngine.advance`) — walks the frozen plan from the cursor:
   bypasses steps whose `if` is false (`SKIPPED`), consumes a buffered event for
   a `WAIT` step, or writes the next `DO` step `PENDING` and stops.
4. **Execute** (`SagaStepWorker`) — claims due `saga_steps` rows
   (`FOR UPDATE SKIP LOCKED` + lease, DO/UNDO only, fairness cap per company),
   resolves a `SagaAction` and settles the step. `ok` → `DONE`; `retry` →
   backoff until `maxAttempts`; `fail` → compensation.
5. **Compensate** (`SagaEngine`) — on failure it runs the completed `DO` steps'
   `UNDO`s in reverse. A completed step with no undo (and no `pivot` before it),
   or a failure past the pivot, parks `FAILED_MANUAL`.
6. **Sweep** (`SagaScheduler`) — one tick runs the worker, expires `WAIT`
   timeouts (`skip` by default, `compensate` when configured) and re-queues
   stale leases. An hourly cron purges inbox rows past retention. There is **no
   reconciler**.

Statuses: `RUNNING | WAITING | COMPENSATING | COMPLETED | COMPENSATED |
CANCELLED | FAILED_MANUAL`. A `WAIT` step's timeout is its `run_at`; it is
settled by the sweep, never by the worker.

## Public ports

```ts
import { FeatureGate } from '@platform/saga/ports/feature-gate.port';
import { CompanySettingsReader } from '@platform/saga/ports/company-settings.port';
import { SAGA_ACTION, SagaAction } from '@platform/saga/ports/saga-action.port';
import { SagaInboundPort } from '@platform/saga/ports/saga-inbound.port';

// entitlement keys + settings are owned OUTSIDE the saga
featureGate.enabled(companyId): Promise<ReadonlySet<string>>;
companySettings.get(companyId): Promise<Record<string, unknown>>;

// one command on one aggregate via its application service
action.do(ctx): Promise<{ outcome: 'ok' | 'retry' | 'fail'; output?; error? }>;
action.undo(ctx): Promise<{ outcome: 'ok' | 'retry' | 'fail'; error? }>;

// feed events in (a broker consumer / business listener calls this)
sagaInbound.accept(envelope: OutboxEnvelope): Promise<void>;
```

`ctx` carries `tenantId`, `companyId`, `sagaKey`, `instanceId`, `stepId`,
`idempotencyKey` (= the `saga_steps` row id), `correlationKey`, `input`;
`undo` also gets `doOutput`.

## Layout

```
ports/
  feature-gate.port.ts           — FeatureGate.enabled(companyId)
  company-settings.port.ts       — CompanySettingsReader.get(companyId)
  saga-action.port.ts            — SagaAction + SAGA_ACTION token
  saga-inbound.port.ts           — SagaInboundPort.accept(envelope)

application/
  expression.ts                  — safe evaluator + `{{ }}` renderer + durations
  plan-builder.ts                — default + overlay merge (narrows only)
  saga-action.registry.ts        — action lookup by name
  saga-engine.ts                 — advance / complete / compensate / cancel
  saga-router.ts                 — inbound port, five checks, start + wait

workers/
  step-worker.ts                 — claim + run + settle a step

repositories/
  prisma-saga.repository.ts      — the five tables (one class per table)

adapters/
  empty-feature-gate.adapter.ts  — fail-closed default (no sagas until wired)
  empty-company-settings.reader.ts

events/saga-emitted.event.ts     — `onComplete.emit` envelope
saga.types.ts                    — statuses, definition/overlay/plan shapes
saga.scheduler.ts                — tick + sweeps + inbox cleanup
saga.module.ts                   — wiring
```

## Who calls it / how called

| Consumer                         | How                                                        |
| -------------------------------- | ---------------------------------------------------------- |
| Broker consumer / listener       | `SagaInboundPort.accept(envelope)`                         |
| Composition root / business      | `SagaActionRegistry.register(action)` (under `SAGA_ACTION`)|
| Scheduler                        | `SagaStepWorker.runBatch()` + `SagaEngine.onWaitTimeout`    |
| Business actions                 | receive `SagaActionContext`, use their own app services     |

The saga imports **no business module**. Business work arrives only through
`SagaAction` providers; gating and settings through their ports.

## Data & config

`saga_definitions`, `saga_company_configs`, `saga_instances`, `saga_steps`,
`saga_inbox` (`prisma/schema/platform/saga.prisma`). Partial uniques — one
ACTIVE definition per key, one live instance per correlation key — are written
in the migration. Config namespace `saga.*` → `ConfigService.getSaga()`; env:
`SAGA_WORKER_LEASE_SECONDS`, `SAGA_CLAIM_BATCH_SIZE`, `SAGA_FAIRNESS_CAP`,
`SAGA_SWEEP_INTERVAL_MS`, `SAGA_RETRY_BASE_DELAY_MS`, `SAGA_RETRY_MAX_DELAY_MS`,
`SAGA_DEFAULT_MAX_ATTEMPTS`, `SAGA_INBOX_RETENTION_DAYS`.

## Tenancy behaviour

Every row is scoped by `tenantId` + `companyId`; the router runs the whole
route inside `RequestContextPort.run` with the event's tenant/company, and the
worker does the same per step. The correlation key is scoped per company, so two
companies never share an instance.

## Rules & gotchas

- Overlays **only narrow**: AND-combined conditions, overridden timing/retry,
  optional on / standard off. A `required` step can never be disabled.
- The plan is **frozen** on the instance at build time; a later settings or
  definition change never affects a running instance.
- Bypass means continue, never wait — a saga never waits for an event the
  company cannot produce.
- Actions must be idempotent on `ctx.idempotencyKey`; the worker settles with a
  CAS write, so a redelivery re-runs the action but never double-applies.
- A `WAIT` step's `run_at` is its timeout instant; the sweep settles it.
- The platform outbox derives an event's type from its class, so
  `onComplete.emit` travels as `SagaEmittedEvent` with the configured name in
  the payload.
- The default `FeatureGate` is fail-closed: nothing starts until an entitlement
  source is wired (module provider / composition-root override).
