# Saga — how it works

Company-configurable cross-aggregate orchestration. A **saga definition** says which
steps must run when one business event happens (post a valuation, post stock, accrue,
wait for a quality inspection…). The platform executes the plan durably and reverses it
when something fails, so no business module has to know about the others.

- Platform code: `src/platform/platform-common/saga/`, `saga-outbox/`, `saga-inbox/`
- Tables: `prisma/schema/platform/saga.prisma` (workbook `DB Tables` column names)
- Reference definition: `src/platform/platform-common/saga/types/definitions/goods-receipt.definition.ts`
- Enforced shape: `src/specifications/architecture/platform-shape.spec.ts` (`MIGRATED`)
- Design source: `docs/erp-system/Common Services.xlsx`, sheet `8-Saga` + `DB Tables`

## 1. Quick start

```bash
npm run db:push        # create the saga tables
npm run db:seed        # registers the goods_receipt v3 definition (ACTIVE)
npm test               # unit specs, no DB needed
npm run test:specifications:platform   # saga integration specs (needs Postgres)
```

Publish a definition programmatically:

```ts
await registerSagaDefinition.execute({
  document: GOODS_RECEIPT_SAGA_DEFINITION, // published document shape
  ownerModule: 'procurement',
});
```

A saga starts when its start event is routed in:

```ts
await sagaInbound.accept(envelope); // canonical OutboxEnvelope
```

## 2. The three modules

Saga state and saga traffic are separated so each ledger can be tuned without touching
the engine. Dependencies point one way only: `saga → saga-outbox`, `saga → saga-inbox`.

| Module                         | Owns                                                          | Seam the engine uses          | Scheduled work                                  |
| ------------------------------ | ------------------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| `platform-common/saga`         | `saga_definitions`, `saga_instances`, `saga_steps` + the engine | `SagaInboundPort`, `SagaActionResolverPort` | `SagaSweepService` tick (`SAGA_SWEEP_INTERVAL_MS`) |
| `platform-common/saga-outbox`  | `saga_outbox` — the saga's own publication ledger              | `SagaOutboxWriterPort`        | dispatch tick + `cleanup-saga-outbox` (hourly)   |
| `platform-common/saga-inbox`   | `saga_inbox` — dedupe + WAIT buffer                            | `SagaInboxPort`               | `cleanup-saga-inbox` (hourly)                    |

`SagaModule` imports the other two and re-exports neither. Everything the engine needs
crosses a port, so no use case ever touches a repository from another module.

Why a private outbox instead of the shared `outbox_messages`: saga lifecycle traffic gets
its own claim cadence, retry budget and retention, so a busy business table can never
delay "saga completed" (and the reverse). Both ledgers share one implementation
(`OutboxLedgerRepository`, bound to a whitelisted table name), so the claim/CAS state
machine exists exactly once.

## 3. Data model

| Table               | Role                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `saga_definitions`  | published definitions; **one ACTIVE row per `(event_name, event_version)`**, `(saga_key, version)` unique |
| `saga_instances`    | one row per running correlation key; holds the **frozen plan snapshot**, `cursor`, `status`, `context`, `last_error` |
| `saga_steps`        | durable work queue + execution log; row `id` **is** the action idempotency key |
| `saga_outbox`       | completion/lifecycle events, appended in the same transaction as the terminal CAS |
| `saga_inbox`        | dedupe per `(tenant, company, consumer, message)` + early-event buffer      |

Rules that are easy to get wrong:

- **Tenancy**: every row carries `tenantId` + `companyId` and every query filters both.
  Routing happens inside `RequestContextPort.run(...)`, restored from the envelope.
- **One live instance per `(tenant, company, saga_key, correlation_key)`**: Prisma cannot
  express a partial unique index, so the row carries a nullable unique `live_key`
  (`encodeURIComponent(sagaKey)|encodeURIComponent(correlationKey)`). The repository sets
  it while the instance is live and NULLs it on every terminal transition — NULLs never
  collide, which is exactly `WHERE status IN ('RUNNING','WAITING','COMPENSATING')`.
- **The plan is a snapshot**: `saga_instances.plan` is written once at start. Editing a
  definition or re-publishing a version affects **new** instances only.
- `saga_instances.config_id` is a reserved workbook column and stays `NULL` (see §14).
- Hand-written SQL must use the physical snake_case names (`RETURNING` aliases every
  column; an un-aliased `RETURNING *` yields undefined camelCase fields).

## 4. Definition format

Definitions are authored as a **document** (`types/saga-definition.document.ts`) and
stored as the **canonical body** (`SagaDefinitionBody`) after `parseSagaDefinition`
normalises them.

```jsonc
{
  "key": "goods_receipt",
  "version": 3,
  "requires": ["inventory.valuation", "inventory.stock_ledger"],
  "start": {
    "event": { "name": "inventory.grn.created", "version": 1 },
    "key": "GRN:{{event.grnId}}",
    "context": { "grnId": "event.grnId", "hasQcItems": "event.hasQcItems" }
  },
  "steps": [
    {
      "id": "valuate",
      "kind": "DO",
      "policy": "REQUIRED",
      "action": { "name": "inventory.valuation.posted", "version": 1 },
      "compensation": { "name": "inventory.valuation.reversed", "version": 1 },
      "requires": ["inventory.valuation"],
      "retryPolicy": "standard"
    },
    {
      "id": "inspect",
      "kind": "WAIT",
      "policy": "STANDARD",
      "waitFor": { "name": "quality.inspection.completed", "version": 1 },
      "match": "GRN:{{event.grnId}}",
      "if": "saga.hasQcItems == true",
      "timeout": "P7D",
      "onTimeout": "SKIP",
      "acceptedEventCondition": "event.status == 'PASSED'"
    }
  ],
  "onComplete": { "emit": { "name": "inventory.grn.posted", "version": 1 } }
}
```

| Field                             | Meaning                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `key`, `version`                  | definition identity; `(key, version)` is immutable once published                                             |
| `requires`                        | features the whole saga needs — missing any one means **no instance at all**                                   |
| `start.event`                     | trigger contract, matched by `(event_name, event_version)`                                                     |
| `start.key`                       | correlation-key template; `{{event.x}}` is substituted from the trigger payload                                |
| `start.when`                      | guard on the trigger event                                                                                     |
| `start.context`                   | `prop → expression` mapping snapshotted onto the instance (readable as `saga.*` later)                          |
| `steps[].kind`                    | `DO` (business work) or `WAIT` (park for an event). Inferred when omitted (`waitFor` ⇒ WAIT)                   |
| `steps[].policy`                  | `REQUIRED` (never dropped), `STANDARD` (dropped when `requires` is missing, overridable), `OPTIONAL` (off unless overlaid) |
| `steps[].action` / `compensation` | action names registered under `SAGA_ACTION`; `compensation` is a **business reversal document**, never a delete |
| `steps[].requires`                | features this step needs                                                                                       |
| `steps[].if`                      | condition evaluated **when the step is reached**; false ⇒ `SKIPPED` and the plan continues                      |
| `steps[].input`                   | `field → expression` over earlier steps (`steps.valuate.output.unitCosts`)                                      |
| `steps[].waitFor` / `match`       | WAIT contract + correlation-key template the delivered event must equal                                        |
| `steps[].when` / `acceptedEventCondition` | per-event filter for a WAIT (both names accepted; setting both is an error)                             |
| `steps[].timeout` / `onTimeout`   | ISO-8601 duration (`P7D`, `PT30M`) and `SKIP` (default) or `COMPENSATE`                                        |
| `steps[].retryPolicy` / `retry`   | named profile (`standard` = platform default, `aggressive` = 5, `none` = 1) or explicit `{ maxAttempts }`       |
| `steps[].pivot`                   | point of no return — a failure after it can no longer compensate (⇒ `FAILED_MANUAL`)                          |
| `cancelOn[]`                      | events that cancel a live instance (compensating if business work already happened)                            |
| `onComplete.emit`                 | event published to `saga_outbox` inside the completion transaction                                             |

Normalisation (`types/saga-definition.parser.ts`): `action → do`, `compensation → undo`,
`acceptedEventCondition → when`, upper-case enums lower-cased, `retryPolicy` resolved to
attempts, `onComplete.emit` reduced to the event name. Publishing rejects unknown
policy/kind/`onTimeout`/`retryPolicy`, a `WAIT` without `waitFor`, a `DO` without an
action, duplicate step ids, ambiguous WAIT filters and an empty step list.

**Expressions** (`types/saga-expression.ts`) are a hand-written scanner + recursive-descent
parser — never `eval`. Supported: literals, paths (`event.source.type`), arrays,
`== != > < >= <= ! && || in`, parentheses. Malformed expressions throw.

**Scope** an expression can read (`types/saga-scope.ts`), derived from rows, never from
mutable state — so a resumed instance evaluates exactly as it did before a crash:

```ts
{ event, saga: { ...startContext, key, correlationKey }, company: { settings }, steps }
```

## 5. Lifecycle — the nine flow steps from the workbook

The workbook's `8-Saga` flow maps one-to-one onto use cases:

| # | Flow step | Where |
| - | --------- | ----- |
| 1 | Publish BASE/OVERRIDE definition, validate, reject invalid | `RegisterSagaDefinitionUseCase` → `parseSagaDefinition` |
| 2 | Build the per-company plan; drop missing-requirement / disabled / non-enabled optional steps; empty plan ⇒ no instance | `BuildSagaPlanUseCase` |
| 3 | Route with the ordered checks: `requires`+policy → `if` → `when` → `match`; bypass continues, never waits | `AcceptSagaEventUseCase`, `AdvanceSagaUseCase` |
| 4 | Start: inline dedupe insert, create instance + plan snapshot + cursor, advance immediately | `AcceptSagaEventUseCase.tryStart` → `StartSagaUseCase` → `AdvanceSagaUseCase` |
| 5 | Advance: `if` false ⇒ `SKIPPED`; DO ⇒ durable `PENDING` row and stop; WAIT ⇒ consume a buffered match or park `WAITING` with a timeout | `AdvanceSagaUseCase` |
| 6 | Worker claims `PENDING` rows (`FOR UPDATE SKIP LOCKED`, lease, small batch, per-company cap), runs the action with `idempotencyKey = step row id`, settles success/retry/failure | `SagaStepWorkerService`, `ExecuteSagaStepUseCase` |
| 7 | WAIT expiry, exhausted retries, business failure or `cancelOn` ⇒ `COMPENSATING`; `UNDO` rows run in reverse completion order, ending `COMPENSATED` or `FAILED_MANUAL` | `ExpireWaitStepUseCase`, `SettleStepFailureUseCase`, `CancelSagaUseCase`, `StartCompensationUseCase`, `SettleStepSuccessUseCase` |
| 8 | Early events buffer by `match` and are consumed when their step arrives; the saga's own output is ignored as a loop guard | `BufferSagaEventUseCase`, `SagaInboxPort`, `AcceptSagaEventUseCase` (`aggregateType === 'Saga'` ⇒ return) |
| 9 | Config changes affect new instances only; running instances use their snapshot | plan snapshot in `saga_instances.plan` |

### 5.1 Start

`SagaInboundPort.accept(envelope)` is the only door. `AcceptSagaEventUseCase`:

1. ignores envelopes with `aggregateType === 'Saga'` (loop guard) and envelopes without
   tenant/company (warn + drop);
2. restores tenancy in CLS (`RequestContextPort.run`);
3. looks up the ACTIVE definition by `(event_name, event_version)`. Found ⇒ **start path**;
   not found ⇒ **cancel + WAIT path** over all active definitions.

Start path: `start.when` guard → feature gate + company-settings readers →
`BuildSagaPlanUseCase` → `renderTemplate(start.key)` → `StartSagaUseCase`. The insert is
guarded by `live_key`, so a redelivered trigger starts **nothing** (it returns `null`; the
existing instance is advanced by the WAIT routing instead) — and a fresh instance is
advanced immediately.

### 5.2 Advance

`AdvanceSagaUseCase` walks the frozen plan from `cursor` and never does business work:

```
while cursor < plan.steps.length:
    step.if false?        → record SKIPPED row, cursor+1, continue
    step is WAIT?         → buffered match for (instance, event, version) satisfying match/when?
                              yes → WAIT row DONE, mark inbox row CONSUMED, cursor+1, continue
                              no  → WAIT row PENDING with runAt = now+timeout
                                    instance.status = WAITING, waitingEvent = "<name>@<version>", stop
    otherwise (DO)        → createIfAbsent(PENDING row with rendered input)
                              already DONE   → fold output into scope, cursor+1, continue
                              already SKIPPED→ cursor+1, continue
                              else           → instance.status = RUNNING, stop (worker takes it)
cursor at end → CompleteSagaUseCase
```

Two properties worth remembering: the walk is **idempotent** (rows are created
`createIfAbsent`, status is CAS-updated), and it stops at the first unit of real work.

### 5.3 Claim + execute

`SagaSweepService` ticks every `SAGA_SWEEP_INTERVAL_MS` and does three things, in order:
claim and execute due steps, expire WAIT timeouts, re-queue stale leases. A second tick
while one is in flight is dropped.

`SagaStepWorkerService` claims `PENDING` rows whose `run_at` is due with
`FOR UPDATE SKIP LOCKED`, stamping `locked_by`/`lock_until` (`SAGA_WORKER_LEASE_SECONDS`)
and capping rows per company (`SAGA_FAIRNESS_CAP`) so one noisy tenant cannot starve the
others.

`ExecuteSagaStepUseCase` runs one claimed row:

- missing instance ⇒ `FAILED`; instance not live ⇒ `SKIPPED`;
- resolves the action through `SagaActionResolverPort` (unknown action ⇒ failure path);
- runs `action.do(ctx)` / `action.undo(ctx)` inside the instance's request context, with
  `ctx.idempotencyKey = <saga_steps row id>` so a lease-expiry re-run cannot double-apply;
- `outcome: 'ok'` ⇒ `markDone(output)` then `SettleStepSuccessUseCase`;
- `outcome: 'retry'` (or any thrown error) ⇒ `reschedule` with exponential backoff
  (`SAGA_RETRY_BASE_DELAY_MS * 2^(attempts-1)`, capped by `SAGA_RETRY_MAX_DELAY_MS`) until
  `maxAttempts`; after that it becomes a failure;
- anything else ⇒ `markFailed` + `SettleStepFailureUseCase`.

### 5.4 Compensation

`StartCompensationUseCase` walks **backwards** from the failed step index and enqueues one
`UNDO` row per completed `DO` step (WAIT steps have nothing to reverse). Guard rails:

- a failure **past the pivot step** ⇒ `FAILED_MANUAL` (no reversal possible);
- a completed step **without `undo`** ⇒ `FAILED_MANUAL` rather than a silent skip;
- `UNDO` rows are executed by the same worker; when the last one succeeds the instance
  becomes `COMPENSATED`;
- an `UNDO` that fails permanently ⇒ `FAILED_MANUAL` (retrying forever would hide it) — a
  human has to look.

`CancelSagaUseCase`: cancelling **before any DO completed** is terminal (`CANCELLED`);
after business work happened, cancel means compensate.

### 5.5 Completion

`CompleteSagaUseCase` CAS-writes `COMPLETED` (which also NULLs `live_key`) and, if the plan
has `onComplete.emit`, appends the event to `saga_outbox` **in the same transaction**, so
"saga completed" and "the downstream event exists" cannot disagree.
`SagaOutboxDispatcherService` publishes it later on `SAGA_OUTBOX_POLL_INTERVAL_MS` with the
shared claim/CAS ledger implementation.

## 6. State machines

Instance (`saga_instance_state`):

```
            start
              │
              ▼
          RUNNING ──wait──▶ WAITING ──event──┐
              │                │            │
              │                └─timeout────┤
              │                             ▼
              ├──────────────▶ COMPENSATING ──all UNDO ok──▶ COMPENSATED
              │                     │
              │                     └─UNDO failed──────────▶ FAILED_MANUAL
              ├─plan end──────────▶ COMPLETED
              └─cancel, no work───▶ CANCELLED
```

Step rows (`saga_step_state`): `PENDING → RUNNING → DONE | SKIPPED | FAILED`, plus
`PENDING → PENDING` on retry (with `attempts+1` and a later `run_at`). A crashed worker is
recovered by the sweep (`findStaleRunning` ⇒ `reschedule` with `STALE_LEASE_ERROR`), not by
a reconciler.

Inbox rows (`saga_inbox_state`): `RECEIVED → BUFFERED → CONSUMED | IGNORED`. A skipped
WAIT parks its still-buffered deliveries as `IGNORED` with the reason, so the ledger stays
truthful instead of holding rows nobody will read.

## 7. Configuration

`src/config/saga.config.ts` (all namespaced under `saga`, registered in `config.module.ts`):

| Env variable                  | Default  | Meaning                                              |
| ----------------------------- | -------- | ---------------------------------------------------- |
| `SAGA_SWEEP_INTERVAL_MS`      | `10000`  | sweep tick (claim, WAIT expiry, stale leases)         |
| `SAGA_WORKER_LEASE_SECONDS`   | `60`     | claim lease; also the fallback WAIT timeout           |
| `SAGA_CLAIM_BATCH_SIZE`       | `20`     | rows claimed per tick                                 |
| `SAGA_FAIRNESS_CAP`           | `5`      | max rows per company per batch                        |
| `SAGA_DEFAULT_MAX_ATTEMPTS`    | `5`      | attempts when a step names none                       |
| `SAGA_RETRY_BASE_DELAY_MS`    | `1000`   | exponential backoff base                              |
| `SAGA_RETRY_MAX_DELAY_MS`     | `600000` | backoff ceiling                                       |
| `SAGA_INBOX_RETENTION_DAYS`   | `30`     | `saga_inbox` purge window (must exceed any broker redelivery window) |
| `SAGA_OUTBOX_POLL_INTERVAL_MS`| `10000`  | `saga_outbox` dispatch tick                           |

Scheduled job names (for metrics/logs): `cleanup-saga-inbox`, `cleanup-saga-outbox`;
the sweep and the outbox dispatcher run on their own intervals, not on `@Cron`.

## 8. Publishing and seeding a definition

`RegisterSagaDefinitionUseCase` is flow step 1: it parses (normalising the document),
checks `(saga_key, version)` and writes an `ACTIVE` row. Republishing the same version is a
**no-op** — the version number is the contract, and two ACTIVE bodies for one version would
make routing non-deterministic. An invalid body throws `BadRequestException` (never
half-applied). A publish never mutates an existing row, which is what keeps running
instances on their plan snapshot.

Definitions live in code next to their domain and are registered by the dev seed:

```ts
// types/definitions/goods-receipt.definition.ts
export const GOODS_RECEIPT_SAGA_DEFINITION = { /* ... */ } satisfies SagaDefinitionDocument;

export const SAGA_DEFINITION_CATALOG = [
  { document: GOODS_RECEIPT_SAGA_DEFINITION, ownerModule: 'procurement' },
];
```

`prisma/seed.ts` iterates the catalogue, runs the same parser and inserts the row if it is
missing (idempotent). There is no HTTP publish endpoint yet — call the use case from a
module that owns the definition, or add the row through the seed/catalogue.

### 8.1 The reference saga: `goods_receipt` v3

`valuate → post_stock → accrue → inspect`, with `inspect` as the WAIT. What the plan
builder produces for different feature sets (asserted in
`types/definitions/goods-receipt.definition.spec.ts`):

| Features enabled                                             | Plan                                        |
| ------------------------------------------------------------ | ------------------------------------------- |
| `inventory.valuation`, `inventory.stock_ledger`, `finance`, `quality.inspection` | `valuate, post_stock, accrue, inspect` |
| `inventory.valuation`, `inventory.stock_ledger`, `quality.inspection`            | `valuate, post_stock, inspect`         |
| `inventory.valuation`, `finance` (no stock ledger)                                | **no saga** (required feature missing) |
| `[]`                                                                             | **no saga**                            |

Each step keeps its `undo` (`inventory.valuation.reversed`, `inventory.movement.reversed`,
`finance.accrual.reversed`), so a failure inside `accrue` reverses `post_stock` and then
`valuate`, in that order.

## 9. Wiring a business module

Three touch points, none of which imports the platform's internals.

### 9.1 Register saga actions (the business work)

```ts
@Injectable()
export class InventoryValuationActions implements SagaAction {
  readonly name = 'inventory.valuation.posted';

  constructor(private readonly postValuation: PostValuationUseCase) {}

  async do(ctx: SagaActionContext): Promise<SagaActionResult> {
    // ctx.idempotencyKey === saga_steps row id — pass it down so a re-run is safe
    const result = await this.postValuation.execute({
      grnId: ctx.input.grnId as string,
      idempotencyKey: ctx.idempotencyKey,
    });
    return { outcome: 'ok', output: { unitCosts: result.unitCosts } };
  }

  async undo(ctx: SagaUndoContext): Promise<SagaUndoResult> {
    await this.reverseValuation.execute({ grnId: ctx.input.grnId as string });
    return { outcome: 'ok' };
  }
}

// the module's providers
{ provide: SAGA_ACTION, useClass: InventoryValuationActions, multi: true }
```

`SagaActionRegistry` collects every `SAGA_ACTION` provider at bootstrap and **throws on a
duplicate name**, so two modules cannot silently claim the same action. Action names in a
definition are exactly these `name` values.

### 9.2 Feed events in

The saga owns no broker adapter: whoever holds a canonical `OutboxEnvelope` calls the port.

```ts
@Injectable()
export class GoodsReceiptCreatedSagaListener {
  constructor(private readonly saga: SagaInboundPort) {}

  @OnEvent('InventoryGoodsReceiptCreated')
  async handle(envelope: OutboxEnvelope): Promise<void> {
    await this.saga.accept(envelope); // routing, dedupe and buffering are the platform's job
  }
}
```

The platform module must import `PlatformModule` and inject `SagaInboundPort` /
`SAGA_ACTION` — never a saga use case or repository.

### 9.3 Nothing else

No registration call, no table writes, no state machine copy. `requires` names are feature
keys resolved by `FeatureGate`; `company.settings.*` comes from `CompanySettingsReader`. Both
are outbound ports with empty (fail-open, dev) adapters today, so a company sees the
platform default until a real feature-gate/settings source is plugged in.

## 10. Operations

- **Health**: `GET /api/v1/health` reports the Prisma read/write probes (plus Redis/brokers
  when enabled). There is nothing saga-specific to register — a saga problem shows up as
  rows and logs, not as an unhealthy probe.
- **Stuck instance?** Read the rows, not the logs: `saga_instances` (`status`, `cursor`,
  `waiting_event`, `last_error`) then `saga_steps` for that instance (`status`, `attempts`,
  `run_at`, `lock_until`, `last_error`).
- **`WAITING` forever**: the event never arrived, or its `match` rendered a different
  correlation key. Compare `saga_instances.correlation_key` with `saga_inbox.correlation_key`.
- **Stale lease**: a `RUNNING` row whose `lock_until` is in the past is re-queued by the
  sweep with `last_error = 'lease expired before the step settled'`.
- **`FAILED_MANUAL`** means "a human must decide": either the failure was past the pivot, a
  completed step had no `undo`, or an `UNDO` itself failed permanently. Nothing retries it.
- **Duplicate prevention**: `saga_inbox` (event dedupe) + `live_key` (one live instance) +
  `createIfAbsent` on steps + `idempotencyKey` for actions.

## 11. Testing

| Spec | Covers |
| ---- | ------ |
| `types/saga-definition.parser.spec.ts` | document → body normalisation and every rejection |
| `types/definitions/goods-receipt.definition.spec.ts` | the workbook mock plans as the sheet describes |
| `use-cases/register-saga-definition.usecase.spec.ts` | publish, idempotency, rejection as 400 |
| `use-cases/build-saga-plan.usecase.spec.ts` | policy/feature filtering, overlay narrowing |
| `use-cases/accept-saga-event.usecase.spec.ts` | routing, loop guard, tenancy |
| `use-cases/advance-saga.usecase.spec.ts` | bypass, WAIT consumption, stop points |
| `use-cases/execute-saga-step.usecase.spec.ts` | outcomes, backoff, unregistered action |
| `use-cases/{settle-*,start-compensation,cancel-saga,expire-wait-step}.usecase.spec.ts` | compensation rules, pivot, WAIT expiry |
| `saga-inbox/**/*.spec.ts` | buffer/dedupe, consume, ignore, retention |
| `saga-outbox/**/*.spec.ts` | writer delegation, envelope/tenancy, dispatcher |
| `saga/specifications/integrations/saga-runtime.integration-spec.ts` | live-key uniqueness, CAS, `SKIP LOCKED`, fairness, retry, WAIT scan (needs Postgres) |
| `saga-outbox/specifications/integrations/saga-outbox-ledger.integration-spec.ts` | the saga ledger against real Postgres |

```bash
npx jest src/platform/platform-common/saga                  # unit
npm run test:specifications:platform                        # integration (Postgres)
npm run test:architecture                                   # hex shape + ports/adapters
```

## 12. Current limitations (read before extending)

- **No company overlays.** `saga_company_overlays` is deliberately not implemented, so plans
  come from the platform definition only. `BuildSagaPlanUseCase` still accepts an `overlay`
  argument (always `null`) as the seam, and `saga_instances.config_id` stays `NULL`.
- **No HTTP surface.** Definitions are published through the use case (seed/catalogue);
  instances are inspected by reading rows. There is no admin API.
- **No business saga actions are registered yet.** `SAGA_ACTION` is empty in this repo, so a
  real definition would fail at execution with `Saga action "…" is not registered` (a
  `FAILED_MANUAL` after compensation, not a crash).
- **`FeatureGate` / `CompanySettingsReader` are empty adapters**: the feature set is empty
  and settings `{}` outside tests, so `requires`-gated steps drop out of every real plan.
- **No `CONFIG_INVALID` flag** (workbook step 9): config validity is enforced at publish time
  instead, which is stricter — an invalid definition never becomes `ACTIVE`.
- **Single-region scheduler**: the sweep and both dispatchers use `setInterval` in-process
  plus DB-side claims. Claims are safe across replicas; the intervals themselves are not
  coordinated beyond that.
