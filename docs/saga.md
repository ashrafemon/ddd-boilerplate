# Saga — how it works

Company-configurable cross-aggregate orchestration. A **saga definition** says which
steps must run when one business event happens (post a valuation, post stock, accrue,
wait for a quality inspection…). The platform executes the plan durably and reverses it
when something fails, so no business module has to know about the others.

- Platform code: `src/platform/platform-common/saga/`, `saga-outbox/`, `saga-inbox/`
- Tables: `prisma/schema/platform/saga.prisma` (workbook `DB Tables` column names)
- Example document (mock, not shipped): `src/platform/platform-common/saga/types/definitions/goods-receipt.example.ts`
- Enforced shape: `src/specifications/architecture/platform-shape.spec.ts` (`MIGRATED`)
- Design source: `docs/erp-system/Common Services.xlsx`, sheet `8-Saga` + `DB Tables`

## 1. Quick start

```bash
npm run db:migrate:deploy   # apply migrations (creates the saga tables)
npm run db:seed        # registers the goods_receipt v3 definition (ACTIVE)
npm test               # unit specs, no DB needed
npm run test:specifications:platform   # saga integration specs (needs Postgres)
```

**Definitions are runtime data — nothing is compiled in and nothing is seeded.** A saga
enters the engine only through the publish endpoint:

```http
POST /api/v1/saga/definitions
{
  "ownerModule": "procurement",
  "status": "ACTIVE",            // or "DRAFT" to validate without routing
  "document": { "key": "...", "version": 1, "start": { … }, "steps": [ … ] }
}
```

The document is parsed (`parseSagaDefinition`), checked (`findDefinitionProblems`) and
rejected with `400 … cannot execute: <reasons>` if the engine could not run it. Publishing
the same `(key, version)` twice is a no-op. The catalogue is readable at
`GET /api/v1/saga/definitions?status=ACTIVE`, re-checkable at
`POST /api/v1/saga/definitions/validate`, and a definition is retired (never deleted) with
`PATCH /api/v1/saga/definitions/:id/status`.

In-process callers use the use case directly:

```ts
await registerSagaDefinition.execute({
  document,                      // published document shape
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

### 2a. Everything crosses the broker — nothing is called directly

| Direction | Routing key | Queue | Consumer |
| --------- | ----------- | ----- | -------- |
| in — domain events | `#` (all events on `erp.events`) | `saga.all-events.erp` | `SagaBrokerConsumerService` → `SagaInboundPort.accept` |
| out — step work | `saga.command` | `saga.commands.erp` | `SagaCommandConsumerService` → `RunSagaStepCommandUseCase` (runs the `SAGA_ACTION`) |
| in — step outcome | `saga.step.result` | `saga.step-results.erp` | `SagaStepResultConsumerService` → `SettleSagaStepResultUseCase` |

Transport is the platform's, not the saga's, in both directions: commands and results
leave through `MessageQueuePort` (`MessagingSagaPublisher`) and the three subscriptions are
registered through `MessageConsumerPort` (`RabbitMqConsumerAdapter`). The saga imports no
broker client and no `@RabbitSubscribe`, so exchange selection, ack policy and any future
transport change stay inside the messaging module. Subscribing is a declaration —
`onModuleInit` passes `{ routingKey, queue }` and a handler:
 
```ts
await this.consumer.subscribe(
  { routingKey: SAGA_COMMAND_ROUTING_KEY, queue: SAGA_COMMAND_QUEUE },
  body => this.onCommand(body),
);
```

The engine never invokes business work itself. `ExecuteSagaStepUseCase` publishes one
command (with `idempotencyKey = step row id`) and stops; the saga state machine only moves
when a result event comes back. Because the queue is the boundary, `saga.commands.erp` can
be consumed by a separate deployment without touching the engine.

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
| 1 | Publish BASE/OVERRIDE definition, validate, reject invalid | `RegisterSagaDefinitionUseCase` → `parseSagaDefinition` + `findDefinitionProblems` |
| 2 | Build the per-company plan; drop missing-requirement / disabled / non-enabled optional steps; empty plan ⇒ no instance | `BuildSagaPlanUseCase` |
| 3 | Route with the ordered checks: `requires`+policy → `if` → `when` → `match`; bypass continues, never waits | `AcceptSagaEventUseCase`, `AdvanceSagaUseCase` |
| 4 | Start: inline dedupe insert, create instance + plan snapshot + cursor, advance immediately | `AcceptSagaEventUseCase.tryStart` → `StartSagaUseCase` → `AdvanceSagaUseCase` |
| 5 | Advance: `if` false ⇒ `SKIPPED`; DO ⇒ durable `PENDING` row and stop; WAIT ⇒ consume a buffered match or park `WAITING` with a timeout | `AdvanceSagaUseCase` |
| 6 | Worker claims `PENDING` rows (`FOR UPDATE SKIP LOCKED`, lease, small batch, per-company cap) and publishes `saga.command` (`idempotencyKey = step row id`); the command consumer runs the action and reports `saga.step.result`, which settles done/retry/failure | `SagaStepWorkerService`, `ExecuteSagaStepUseCase` (publish), `SagaCommandConsumerService` + `RunSagaStepCommandUseCase` (execute), `SagaStepResultConsumerService` + `SettleSagaStepResultUseCase` (settle) |
| 7 | WAIT expiry, exhausted retries, business failure or `cancelOn` ⇒ `COMPENSATING`; `UNDO` rows run in reverse completion order, ending `COMPENSATED` or `FAILED_MANUAL` | `ExpireWaitStepUseCase`, `SettleStepFailureUseCase`, `CancelSagaUseCase`, `StartCompensationUseCase`, `SettleStepSuccessUseCase` |
| 8 | Early events buffer by `match` and are consumed when their step arrives; the saga's own output is ignored as a loop guard | `BufferSagaEventUseCase`, `SagaInboxPort`, `AcceptSagaEventUseCase` (`aggregateType === 'Saga'` ⇒ return) |
| 9 | Config changes affect new instances only; running instances use their snapshot; an invalid config flags `CONFIG_INVALID` and alerts | plan snapshot in `saga_instances.plan`; `ValidateActiveSagaDefinitionsUseCase` + `SagaDefinitionIntegrityService` (status `INVALID`) |

### 5.0 Where events come from — the broker, nothing else

Step 2 onward assumes an envelope already arrived. That edge is
`SagaBrokerConsumerService` (`services/saga-broker-consumer.service.ts`): it subscribes via
`MessageConsumerPort` to routing key `#` with the durable queue `saga.all-events.erp`. Every
delivery is mapped back into the canonical `OutboxEnvelope` by `fromWireEnvelope` and handed
to `SagaInboundPort.accept`. The saga owns no other input: no in-process event bus, no
business use case calling it directly.

`#` rather than a per-event binding because the saga is data-driven — which events
matter is decided by rows in `saga_definitions`, so a static binding list would need a
redeploy for every new saga. The router ignores what it does not route.

Delivery is at-least-once: the message is acked only after `accept` returned. Duplicates
are absorbed by the saga's own dedupe (`live_key` for starts, `saga_inbox` uniqueness per
delivery for WAIT steps), which is why redelivery is safe.

Producer side (why the body is complete): the publisher serialises through `toWireEnvelope`, so `tenantId`, `companyId`, `eventVersion`,
`correlationId` and `causationId` survive the hop. Without them a consumer cannot scope
or dedupe anything — the saga would silently ignore every event as "no tenant/company".

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

Consumption is a **compare-and-set on `BUFFERED`** (`markConsumed` → `false` when it lost).
The order matters: the WAIT step row is written first (idempotent on
`(instanceId, stepId)`), then the delivery is consumed. A crash in between leaves the event
buffered and retryable; a lost race means a concurrent worker matched the same delivery,
which is harmless because both the step row and the completion are idempotent — the ledger
write is what tells the loser its work was redundant.

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

A publish is validated twice: structurally (`parseSagaDefinition`) and semantically
(`findDefinitionProblems` — every `do` has a compensation or is a `pivot`, every
condition/template parses, every duration is ISO-8601, the plan has at least one action
step). A definition that fails either is rejected with `400`.

### 8a. `INVALID` — a published definition that stopped being executable

`SagaDefinitionStatus` is `DRAFT | ACTIVE | INVALID | RETIRED`. `INVALID` is the
`CONFIG_INVALID` flag from flow step 9: something changed after publishing (an action is no
longer registered, an expression no longer parses). `SagaDefinitionIntegrityService` runs
`ValidateActiveSagaDefinitionsUseCase` on bootstrap — the first moment action registration is
complete — and flips broken definitions to `INVALID` with an error log (the alert hook).

Consequences, all deliberate:

- the router reads `ACTIVE` only (`findActiveByEvent`, `listActive`), so **no new instances**
  start from an invalid definition;
- **running instances are untouched** — they finish on the plan snapshot they started with;
- nothing is deleted or rewritten, so fixing the cause and setting the row back to `ACTIVE`
  resumes new instances;
- the boot check never blocks startup: an unreachable database logs a warning.

Definitions are **rows published at runtime**, not code. `prisma/seed.ts` seeds no saga;
the dev/QA database starts empty and definitions arrive through
`POST /saga/definitions`. That is the whole point of the design: the steps, conditions,
feature gates and retry policy of a saga are operator data, so a new flow needs a publish
call, not a deployment.

`types/definitions/goods-receipt.example.ts` is the workbook's **mock** definition kept as an
example and test fixture. It is never imported by runtime code and never seeded — read it as
documentation of the shape, not as a shipped saga.

### 8.1 The example document: `goods_receipt` v3 (mock, not shipped)

`valuate → post_stock → accrue → inspect`, with `inspect` as the WAIT. What the plan
builder produces for different feature sets (asserted in
`types/definitions/goods-receipt.example.spec.ts`):

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

The action below is **not** called by the saga. It is resolved by
`SagaCommandConsumerService` when a `saga.command` message arrives, which is why it must
return a result contract instead of throwing for business failures, and why a deployment
can host the command consumer separately from the engine.

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

Queue to watch when a saga is stuck: `saga.commands.erp` (work not being picked up) and
`saga.step-results.erp` (outcome not coming back). A step left `RUNNING` is retried by the
sweep once its lease expires, so a backed-up command queue looks like slow progress, not
like lost work.

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
| `types/saga-definition.validator.spec.ts` | executable checks: undo-or-pivot, expressions, templates, durations, actions |
| `use-cases/validate-active-saga-definitions.usecase.spec.ts` | `INVALID` flagging + error log |
| `services/saga-definition-integrity.service.spec.ts` | boot sweep is fail-soft |
| `services/saga-broker-consumer.service.spec.ts` | event edge: maps the wire body, filters, never requeues a poison message |
| `use-cases/run-saga-step-command.usecase.spec.ts` | command consumer: runs the action in tenant context, publishes the result, ignores stale/unknown rows |
| `use-cases/settle-saga-step-result.usecase.spec.ts` | result edge: ok/retry/fail + duplicate absorption |
| `types/saga-command.types.spec.ts` | command/result envelope round trip |
| `types/definitions/goods-receipt.example.spec.ts` | the workbook mock plans as the sheet describes |
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
- **`INVALID` needs a reachable database.** The boot sweep marks broken definitions `INVALID`
  and logs an error, and there is no admin endpoint to flip one back — that is a deliberate
  manual step for now.
- **Single-region scheduler**: the sweep and both dispatchers use `setInterval` in-process
  plus DB-side claims. Claims are safe across replicas; the intervals themselves are not
  coordinated beyond that.
- **No per-aggregate ordering guarantee.** Both ledgers carry `aggregate_id` and
  `aggregate_version`, but publication order across batches is not enforced — a consumer that
  needs "all events of one GRN in order" must reorder on `aggregate_version` itself. Adding
  partitioning by aggregate would be the fix if order becomes a requirement.
- **No replay surface.** `FAILED_MANUAL` instances and `DEAD_LETTER`/`SUSPENDED` rows are
  parked, not requeued: recovery is a manual SQL/ops action today.
- **The trigger is RabbitMQ-only.** The saga queue is a `#` binding on the RabbitMQ topic
  exchange — the only broker driver this deployment ships (`kafka`/`sqs` envelopes are
  parked `FAILED` by `PublishMessageUseCase`). A second driver would need a stable aggregate
  topic (e.g. `platform.events`) before the saga could be triggered there.
- **No dead-letter exchange on the saga queue.** A failed `accept` is logged and acked
  rather than requeued forever; retry is the producer's outbox, not the consumer. A DLX with
  a retry budget is the production-grade upgrade.
- **A saga cannot progress without a broker.** Step work is a published command and the
  outcome is a published result, so with RabbitMQ unreachable a claimed step simply stays
  `RUNNING` until its lease expires and is re-dispatched — no work happens, nothing is lost.
- **Action execution is at-least-once, not exactly-once.** A redelivered `saga.command` runs
  the action again; correctness rests on the action honouring `idempotencyKey` (the step row
  id), which is the same contract the in-process version had.
- **No DLX on the command/result queues.** A consumer error leaves the step `RUNNING` so the
  saga's lease sweep retries it; the queues themselves have no dead-letter target yet.
