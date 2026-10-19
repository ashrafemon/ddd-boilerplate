# Purchasing Upgrade — Phase Plan (PurchaseOrder + GoodReceiptNote)

> **STATUS: PHASES 0–6 DELIVERED — this file is the historical design record.**
> Every phase below landed in the code; the phase descriptions are kept as
> written so the intent stays traceable — **the code is the source of truth**.
> What is still open against the *spec* (`update/BusinessAggregate.md`) is
> listed in **§D2** (Definition-of-Done pass) and under "Still open against the
> spec": the deferred AP / three-way-matching scope (workstream H) and the
> tenant-scoping of the business tables, which rides with the IAM build.
>
> **Source spec:** `update/BusinessAggregate.md` (repo root) — "ERP Purchasing Module —
> DDD Update Specification" (PO/GRN lifecycles, partial receipts, over-receipt, inventory
> integration, three-way matching).
>
> **Scope guard:** all work stays inside `src/business/**`. Anything outside that folder
> is listed in §0.2 as a **flagged exception** requiring separate explicit approval.

---

## 0. Ground rules

### 0.1 Platform baseline this plan builds on (verified committed & green at `ee27c99`)

The platform design-alignment is **done**: `npx tsc` exit 0, `npm run lint:check` clean.
(The `npm test` 187/187 figure below is from `ee27c99`; the unit specs were
removed in `0f32e4d`, so the suite no longer exists — the DB-backed e2e suite
is the executable check today.) The purchasing work starts from these exact,
source-verified shapes:

| Service                | Shape business code consumes                                                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Outbox**             | One port, one call: `OutboxWriterPort.append(event, aggregateType, aggregateId, opts?: { broker?: 'rabbitmq'                                                                                                                                                                      | 'kafka'                                                | 'sqs' })`— inside the caller's`@Transactional()`. Statuses `PENDING → PUBLISHED \| DEAD_LETTER`. Business `DomainEvent`satisfies the platform`OutboxEvent`interface **structurally**, so the existing business`OutboxAdapter.send(event, id)` integration-port pattern works **unchanged**. |
| **Canonical envelope** | `OutboxEnvelope` (`src/platform/outbox/outbox.types.ts`) is THE shape on every transport and the in-process bus: stable `eventId`/`occurredAt`/correlation/causation, `tenantId`, **`companyId`**, `aggregateType/Id`, `payload`, `headers`, `broker`. Zero rehydration anywhere. |
| **In-process bus**     | `InProcessEventBus.emit(envelope)` — thin, at-most-once. Business listeners use `@OnEvent('<EventType>')` and read **`message.payload`** — never a rehydrated event instance.                                                                                                     |
| **Message queue**      | `MessageQueuePort.publish(envelope)` — routes on `envelope.broker`. An unconfigured broker **throws**, the outbox keeps the row `PENDING` and retries toward `DEAD_LETTER` — a missing broker never blocks a business transaction.                                                |
| **Context**            | `RequestContextPort.getTenantId() / getCompanyId() / getUserId()`; `PrismaReadPort` for query repos.                                                                                                                                                                              |
| **Audit**              | `AuditPort.record({ action, entityType, entityId, changes?, actorType?, actorId?, tenantId?, companyId? })`.                                                                                                                                                                      |
| **Idempotency**        | `IdempotencyPort.reserve / complete / fail`; identity `{ tenantId, companyId, scope, key }`.                                                                                                                                                                                      |
| **Inbox**              | `InboxPort.receive / complete / fail`; identity `{ tenantId, companyId, consumer, messageId }`.                                                                                                                                                                                   |
| **Cache**              | `CachePort.buildKey(identity) / get(HIT                                                                                                                                                                                                                                           | MISS) / set(ttlMs?) / delete` — disposable, fail-open. |
| **Numbering**          | `NumberingPort.nextNumber(key, opts)` — race-safe upsert-increment, tenant/company-namespaced.                                                                                                                                                                                    |
| **Naming**             | `organizationId` was renamed to **`companyId` globally** (code + migrations). New purchasing code must use `companyId`; never reintroduce the old name.                                                                                                                           |
| **Test doubles**       | Platform ships **no** `__testing__` doubles (they live in `test/support/`). Business specs use inline fakes + `initNoopTransactionHost()`.                                                                                                                                        |
| **Bootstrap bridges**  | `configure-batch-operations.ts`, `configure-imports.ts`, `configure-notifications.ts` exist; `configure-event-rehydration.ts` is **gone** (nothing to bridge rehydrators into).                                                                                                   |

### 0.2 Architecture contract every phase must obey (AGENTS.md / ARCHITECTURE.md)

- Aggregate is the **sole mutation path**: `domain/factories` (invariant-enforced) builds,
  `aggregate.pullEvents()` drains; domain folders import **no** `@nestjs/*`.
- Command use cases: `@Transactional()` → command repository port → outbox append — all in
  the **same DB transaction**. Query use cases: query port on `PrismaReadPort`, never
  aggregates.
- **One use case per file**, **one request DTO per file** (zod via `createZodDto`), thin
  controllers, `@DeviceResponse` for web/mobile variants.
- Invariants/policies in the **keyed registries** (`invariantRegistry` / `policyRegistry`),
  side-effect-imported by the factory. (Note: the domain-event _rehydrator_ registry was
  removed platform-wide — event classes need **no registry files** anymore.)
- Cross-module calls only via another module's `public/**` (producer) + this module's
  `application/outbound-ports/**` + a consumer-side adapter (`infrastructure/adapters/module/`).
- Side effects leave the process only through the module's integration-port adapter →
  `OutboxWriterPort`, inside the caller's transaction.
- Platform services are consumed as **exported port tokens** via
  `imports: [PlatformModule]` — never concrete classes, never raw clients.

### 0.3 Flagged exceptions (files OUTSIDE `src/business/` — need explicit approval each)

| Exception                                                                                                                | Why unavoidable                                                                                                                          | Phases     |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `prisma/schema/procurement/purchase-order.prisma` + `good-receipt-note.prisma` | New columns/enum values (actor fields, `ISSUED`, accepted/rejected qty, reversal link, nullable `receivedAt`) are module table contracts; the schema file IS the table contract (no migration folder — `npm run db:push`) | 0, 2, 3, 4 |
| `prisma/schema/inventory/*.prisma` (new)                                                                                 | Inventory ledger table contract                                                                                                          | 5          |
| `eslint.config.mjs` `businessModules` entry                                                                              | New `inventory` context module                                                                                                           | 5          |
| `src/bootstrap/configure-notifications.ts` bridge rows                                                                   | New `NotificationHandler` opt-ins are registered by the composition root (§9.1 standard) — file confirmed to exist                       | 6          |
| `npm run docs:di` output (`docs/DI-WIRING.md`)                                                                           | Generated; rewrites itself when module providers change                                                                                  | any        |
| `ARCHITECTURE.md` §7 / module README updates                                                                             | Docs move with code                                                                                                                      | 6          |

If an exception is not approved, the phase delivers code-side only and hands the owner the
exact SQL/config to apply manually.

---

## A. Audit recap (baseline — business-side facts, unaffected by the platform rewrite)

### A.1 Already correct — preserve, do not rewrite

- Explicit PO transitions + DRAFT-only editing + has-lines + positive-qty invariants;
  server-side totals via `Money` VO.
- Approval-threshold policy + `CompanyConfigPort.autoApproveThreshold`.
- Vendor orderability on create; product purchasability on add-line.
- **Transactional outbox flow in both modules — already on the new one-port shape**
  (`OutboxAdapter.send(event, id)` → `OutboxWriterPort.append`); business adapters need
  **zero changes** from the platform rewrite.
- Idempotent `setLine()` + `externalReference` find-or-create (import path).
- Cross-module `PurchaseOrderForGrnPort` + facade (foundation for receiving checks).
- Platform integrations live: scheduler/recurring (PO templates), batch-operation (bridged;
  adapters delegate to single-record use cases), import (bridged), notification handler for
  `PurchaseOrderApproved` (bridged via `configure-notifications.ts`).
- All business listeners already consume the canonical envelope (`message.payload`).

### A.2 Bugs — fix before any feature work (Phase 0)

| #   | Bug                                                                                                                                                                                                                                                       | Evidence                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| B1  | **GRN lines never persist.** `save`/`update` pass `lines` as a bare array (invalid Prisma relation syntax; needs `{ deleteMany:{}, create:[...] }` like the PO repo) and `findById` never `include: { lines: true }` although the mapper maps `row.lines` | `prisma-grn-command.repository.ts`, `prisma-grn.mapper.ts`      |
| B2  | **GRN editable after receipt.** `grn.editable` allows `['DRAFT','RECEIVED']` — lines can be added post-receipt                                                                                                                                            | `grn.invariants.ts`                                             |
| B3  | **Silent approve no-op.** Above-threshold `approve` is skipped — HTTP 200, nothing changes                                                                                                                                                                | `purchase-order-transition.usecase.ts`                          |
| B4  | **Race-prone numbering.** PO `nextOrderSequence()` = last-row arithmetic; GRN number = `GRN-${Date.now()}` (collision-prone); the PO module's race-safe `NumberingPort` adapter exists but is **unused**                                                  | `prisma-purchase-order-command.repository.ts`, `grn.factory.ts` |
| B5  | **GRN ignores PO contents.** Create only checks PO _exists_; vendor/qty/price never validated; receiving against DRAFT/REJECTED/CANCELLED PO possible                                                                                                     | `create-grn.usecase.ts`                                         |
| B6  | **No optimistic concurrency.** `version` columns exist but both repos do last-write-wins `update where { id }`                                                                                                                                            | both command repos                                              |
| B7  | **GRN money is raw numbers** (no `Money` VO); `receivedAt` stamped at creation; GRN `cancel()` has no use case/endpoint                                                                                                                                   | `grn.aggregate.ts`, `grn.factory.ts`                            |

### A.3 Missing capability map (workstreams)

- **A** PO commercial fields (order date, expected delivery, description snapshot, actors)
- **B** PO lifecycle: `ISSUED`, close, amendment, approval records, cancel blocked by
  receipts, derived receipt status
- **C** GRN model: accepted/rejected split, PO-line reference, posting semantics, reversal
- **D** Receiving integrity: over-receipt tolerance + atomic balance check (PO-07)
- **E** Policies: OverReceipt, Cancellation, Closure (Inspection/Matching/AP deferred)
- **F** Events: `PurchaseOrderIssued/Closed`, `GoodsReceiptPosted/Reversed`
- **G** Inventory context (new module): `inventory_movements` ledger, idempotent consumers
- **H** AP / three-way matching — **explicitly deferred** (no AP module exists)
- **I** API gaps: `PATCH /:id`, line update, `issue`/`close`, GRN `post`/`reverse`/cancel,
  `GET /purchase-orders/:id/receipts`, `/remaining-quantities`
- **J** Tests: no GRN aggregate spec, no use-case specs (except import), no concurrency tests

---

## B. Phase plan

Each phase ends with §D verification green before the next starts. Order: **bugs die
first**, then **platform behaviors as shared foundation**, then domain features.

### Phase 0 — Correctness baseline (no new features)

1. **B1 — GRN persistence round-trip.** `good-receipt-note/infrastructure/persistence/prisma-grn-command.repository.ts`:
   `save` → `create({ data: {...toRow(grn), lines: { create: toLinesCreateInput(grn) } } })`;
   `update` → `deleteMany: {}` + `create` (mirror PO repo); `findById` →
   `include: { lines: true }`. Split header vs lines in `prisma-grn.mapper.ts`.
2. **B2 — Immutability.** `grn.invariants.ts`: `grn.editable` → `status === 'DRAFT'` only;
   re-check `GrnBatchOperationAdapter.ALLOWED_FROM`.
3. **B7 — Money + receivedAt.** GRN totals through the shared `Money` VO; `receivedAt`
   nullable (schema **exception**), set by `receive()` only.
4. **B4 — Numbering.** PO create switches from `nextOrderSequence()` to the module's wired
   `NumberingPort` adapter (key `purchase-order.number`, `prefix 'PO-'`, `padding 8` —
   output stays `PO-00000001`). GRN gets its own module-local port + adapter pair
   (`application/outbound-ports/numbering.port.ts` + `infrastructure/adapters/platform/numbering.adapter.ts`,
   copy PO's); the factory receives `grnNumber` as **input**. Seed sequences above current
   max (migration note). Delete dead `nextOrderSequence`/`nextGrnSequence` repo helpers.
5. **B3 — Explicit approval.** `purchase-order-transition.usecase.ts`: above-threshold
   `approve` throws `ConflictException` (409 "manual approval required") instead of a silent
   no-op. (Approver authority arrives with Phase 2's approval record.)
6. **B6 — Optimistic concurrency CAS.** Both repos: `update()` →
   `updateMany({ where: { id, version }, data: { ..., version: { increment: 1 } } })`;
   zero rows → 409. Mappers thread the real `version` (GRN mapper currently hardcodes `1`).
7. **B7 — GRN cancel exposure.** New `cancel-grn.usecase.ts` + `PATCH /grn/:id/cancel` +
   `CancelGrnDto`.
8. **Tests.** New `grn.aggregate.spec.ts`, `prisma-grn.mapper.spec.ts` (round-trip incl.
   lines), use-case specs with **inline fakes** + `initNoopTransactionHost()`; update
   `purchase-order.aggregate.spec.ts` (CAS + explicit approval).

**Schema (exception):** `receivedAt` nullable.

---

### Phase 1 — Platform-service behaviors in the business modules

Goal: every platform primitive the repo mandates is consumed by PO/GRN through the
sanctioned shape. This is the shared foundation Phases 2–4 build on.

**Injection discipline (matches the existing DI graph):**

| Style                                                                    | When                                                                               | Precedent                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Module-local outbound port + `infrastructure/adapters/platform/` adapter | Capability carries **module semantics** (sequence keys, entity-specific rendering) | PO `numbering.adapter.ts`, `company-config.adapter.ts`, `outbox.adapter.ts`         |
| Direct injection of the **platform port token** (via `PlatformModule`)   | Pure infrastructure seams, no module semantics                                     | `PrismaReadPort` in query repos; `RequestContextPort`/`LoggerPort` in PO's DI graph |

**Never:** concrete platform services, raw clients, `@nestjs/schedule` in business.

#### 1.1 `NumberingPort` — race-safe document numbers _(completes Phase 0.4)_

- Keys `purchase-order.number` / `grn.number` (tenant/company-namespaced by the platform
  service). Every document-creating path uses the port; nothing else invents numbers.
- Tests: create use case asserts key + options.

#### 1.2 `RequestContextPort` — actor & tenant/company stamping

- Inject into every command use case (create/add-line/remove-line/transition for PO;
  create/add-line/receive/complete/cancel for GRN; plus the new issue/close/post/reverse).
- Pattern: `const actor = this.requestContext.getUserId()` with an **explicit input
  override** (`input.actorId ?? ctx`) so background executions (batch/import/recurring
  workers restoring context via `run()`) stay correct.
- Persisted into new nullable actor columns (Phase 2 schema, **exception**): `createdBy`,
  `approvedBy`, `rejectedBy`, `issuedBy`, `cancelledBy`, `receivedBy`, `postedBy`.
- Stamp `companyId` from `getCompanyId()` wherever a new column needs it.
- Tests: fake context; HTTP-present and worker-override paths.

#### 1.3 `AuditPort` — same-transaction transition trail

- Direct token injection; record **inside** each transition's `@Transactional()`:
  `purchase-order.{approve,reject,cancel,issue,close}`, `grn.{receive,post,reverse,cancel}` —
  `audit.record({ action, entityType: 'PurchaseOrder'|'GoodReceiptNote', entityId, actorId, tenantId, companyId })`.
- Tests: fake port — one row per successful transition, **none** when it throws.

#### 1.4 `IdempotencyPort` — replay-safe costly commands

- Programmatic `reserve / complete / fail` around the `@Transactional()` work in
  `create-grn.usecase.ts` (scope `grn.create`) and Phase 3 `post` / Phase 4 `reverse`
  (scopes `grn.post` / `grn.reverse`); identity `{ tenantId, companyId, scope, key }` from
  `RequestContextPort` + a client-supplied `idempotencyKey` DTO field.
- Semantics per platform README: `REPLAY` → stored result, `BUSY` → 409,
  `KEY_MISMATCH` → 400, `fail()` on any exception.
- PO create is **already** idempotent via `externalReference` find-or-create — do not
  double-protect; document the divergence.
- Alternative (§E-7): controller-level `@Idempotent()` if confirmed exported for business.
- Tests: fake port — replay returns original id; BUSY → `ConflictException`; failure → `fail()`.

#### 1.5 `DistributedLockPort` — deliberately NOT used (documented decision)

- The PO-07 receiving guard (Phase 3) is enforced by **row locks** (`SELECT … FOR UPDATE`
  on `purchase_order_lines` inside the joined CLS transaction): DB-native, crash-safe.
  A Redis lease would duplicate a weaker guarantee. Port stays reserved for future
  non-transactional critical sections (fail-closed, owner token).

#### 1.6 `CachePort` — disposable read-model caching _(optional, §E-9)_

- If approved: query-side decorator around `get-purchase-order` / `get-grn`: key **only**
  via `cachePort.buildKey({ ...identity })`; `get` → `HIT` returns, `MISS` loads repo →
  `set(key, record, ttl)`; command use cases `delete(key)` after successful save
  (documented pre-commit race acceptable — cache is disposable, Postgres is the source of
  truth, adapter is fail-open). No list-query caching.
- Tests: fake port; HIT short-circuits; MISS loads+stores; invalidation on command; cache
  errors never fail requests.

#### 1.7 `CompanyConfigPort` — thresholds & tolerances

- Today: `defaultCurrency` + `autoApproveThreshold` (already consumed). Phase 3 adds
  **over-receipt tolerance**: module policy constant now; company override needs a
  `company_configs` column (**exception**, §E-8).

#### 1.8 `NotificationDispatchPort` — side effects via the existing bridge

- Precedent: `purchase-order-notification.adapter.ts` — pure `NotificationHandler`
  (resolveRecipients/resolveModel only) keyed to a domain event name, registered by
  `src/bootstrap/configure-notifications.ts` (**exception**, §E-10).
- Phase 6 adds `PurchaseOrderIssued` (vendor email) and `GoodsReceiptPosted`
  (warehouse/receiving) handlers. Inert until bridge rows are approved — designed
  degradation, not a bug.

#### 1.9 `InboxPort` — consumer-side dedupe _(activates with the first real listener)_

- Current `*.listener-event.ts` files are template loggers. When any listener starts doing
  real work (Phase 5 inventory consumer, Phase 6 side effects), the handler **must** first
  `inbox.receive({ tenantId, companyId, consumer, messageId: envelope.eventId })` and
  `complete`/`fail` around the delegated use case — duplicate-delivery safety for free.
- The envelope's stable `eventId` is the dedupe key by design (survives the async hop).

#### 1.10 Event fan-out for new events — zero platform work

- New business events ride the existing `OutboxAdapter.send(event, aggregateId)` unchanged
  (structural `OutboxEvent`). Broker choice is per-call: `opts.broker` only when a
  Kafka/SQS listener is ever added; default `rabbitmq` needs nothing. In-process listeners
  get the envelope via `@OnEvent('<EventType>')` — read `message.payload`.

#### 1.11 Already integrated — verify only, change nothing

- **Outbox** (both modules on the one-port shape), **Scheduler/Recurring**
  (`RecurringTemplatePort`/`RecurringExecutionPort` still consumed by PO recurring use
  cases), **BatchOperation** (bridged; adapters delegate to single-record use cases so
  every Phase 2–4 validation is inherited — review `ALLOWED_FROM` status maps when
  statuses change), **Import** (bridged; `setLine` stays its idempotency), **PrismaReadPort**
  (query repos), **Observability** (global interceptors; no per-use-case logger noise).

#### 1.12 Do-not list (all of Phase 1)

- ❌ import platform concrete classes (`*Service`, repositories, adapters)
- ❌ hand-written cache keys, hand-rolled sequences, `Date.now()` document numbers
- ❌ audit/outbox writes outside the use case's transaction
- ❌ reintroducing `organizationId` (renamed to `companyId` globally) or rehydrator
  registry files (machinery removed)
- ❌ listeners parsing anything but `message.payload`; listeners with real logic not
  wrapped in `InboxPort`
- ❌ swallowing CAS/idempotency `ConflictException`s — 409 is the API contract
- ❌ touching `src/platform/**` to "make it fit" — a platform gap means stop and ask

---

### Phase 2 — PO lifecycle to ERP shape

1. Status: add `ISSUED` to `PurchaseOrderStatus` (domain enum + Prisma enum, additive
   **exception**). Transitions `APPROVED → ISSUED → COMPLETED`; cancel from
   DRAFT/SUBMITTED/APPROVED; others terminal (§E-1). Update the
   `purchase-order.status-transition` invariant + aggregate spec.
2. Commands (one use case each) + endpoints: `PATCH /purchase-orders/:id` (draft header:
   expectedDeliveryDate, externalReference), `PATCH /:id/lines/:productId` (draft line
   update via `setLine` semantics), `POST :id/issue` (≥1 line, APPROVED → ISSUED; event
   `PurchaseOrderIssued`; audit + `issuedBy`), `POST :id/close` (`ISSUED → COMPLETED`;
   legacy `complete` endpoint delegates to close — §E-1).
3. Approval record (minimal): nullable `approvedBy/approvedAt/rejectedBy/rejectedAt/
rejectionReason` columns (**exception**); `reject(reason)` stores the reason (no silent
   `'Rejected'` default at the HTTP layer).
4. **CancellationPolicy** (`domain/policies/cancellation.policy.ts`, keyed registry): block
   cancel when the PO has posted receipts — new GRN public port
   (`GrnForPurchaseOrderPort.hasReceipts(poId)` + consumer-side adapter + GRN facade
   delegating to a new query use case).
5. Line identity: keep one-line-per-product merge + `@@unique([purchaseOrderId, productId])`
   (import idempotency depends on it) — documented deviation (§E-2).
6. Events: `PurchaseOrderIssued`, `PurchaseOrderClosed` — new domain event classes +
   integration wire shapes in `application/integrations/publishes/`. **No registry files**
   (rehydration machinery removed); in-process listeners consume `message.payload`.
7. Tests: aggregate spec for new transitions; use-case specs (issue preconditions, cancel
   blocked via fake port); batch `ALLOWED_FROM` review.

---

### Phase 3 — Receiving integrity (PO ↔ GRN) — the heart of the spec

1. **GRN creation validates against the PO** (`create-grn.usecase.ts`): PO status must be
   receiving-eligible (`ISSUED`), `input.vendorId` equals the PO's vendor, each line
   references a real PO line; `orderedQuantity`/`unitPrice` **snapshotted from the PO line**
   (client values ignored; mismatch → 422). Extend `PurchaseOrderReference` in PO
   `public/contracts/` (producer-owned) with whatever read shape this needs.
2. **Accepted/rejected split** (GRN-01/02): `GrnLine` gains `acceptedQuantity` /
   `rejectedQuantity` (schema **exception**); invariant `received = accepted + rejected`;
   minimal `record-inspection-result` command (accept = received by default).
3. **Atomic receiving balance (PO-07)** — ownership-preserving design: the GRN
   post/receive use case (its `@Transactional()`) calls a new **PO public port**
   `registerReceipt(poId, lines, actor)`; the consumer-side adapter delegates to a new PO
   use case that joins the same CLS transaction, locks the PO lines `FOR UPDATE`, enforces
   `net_received + proposed ≤ ordered × (1 + tolerance)` per line (**OverReceiptPolicy**,
   keyed registry; tolerance per §1.7), writes the received-qty projection and raises
   `PurchaseOrderReceiptRecorded`. PO owns the balance; GRN owns the document; no
   cross-module table access.
4. Derived receipt status on the PO read model: `NOT_RECEIVED | PARTIALLY_RECEIVED |
FULLY_RECEIVED` (computed, never manually set).
5. Idempotent posting: status guard (post only from `RECEIVED`) + §1.4 `IdempotencyPort` —
   redelivery re-runs, never double-applies.
6. New reads: `GET /purchase-orders/:id/receipts`, `GET /purchase-orders/:id/remaining-quantities`
   (query use cases on `PrismaReadPort`).
7. Tests: use-case specs with inline fakes (over-receipt blocked, tolerance boundary,
   vendor mismatch, wrong PO status, accepted+rejected reconciliation);
   **integration/concurrency test** via `npm run test:e2e` with `docker compose up -d`
   (two concurrent receipts cannot exceed the limit — never reported green without
   actually running it).

---

### Phase 4 — Reversal & returns

1. `POST /grn/:id/reverse` (new use case + DTO): only from `RECEIVED`; creates a
   **compensating reversal document** referencing the original (`reversalOfId` column,
   **exception**) with mirrored/negative quantities — the original rows are never mutated.
   Calls the PO port with a reversal entry (balance returns); event
   `GoodsReceiptReversed` (+ wire shape, no registry); audit + `postedBy/reversedBy` (§1.3);
   `IdempotencyPort` scope `grn.reverse` (§1.4).
2. Optional minimal `create-supplier-return` — or explicitly deferred (§E-5).
3. Tests: reversal preserves history, cannot exceed original eligible quantity, idempotent
   under redelivery, PO balances reconcile.

---

### Phase 5 — Inventory context (new business module — optional, §E-5)

1. New context `src/business/inventory/stock-movement/` cloned from the `product` reference
   layout, added to `businessModules` in `eslint.config.mjs` (**exception**).
2. Table `inventory_movements` (**exception**): item, quantity (+base qty), movement type,
   source document + line (`@@unique([grnLineId, movementType])` = natural idempotency),
   from/to location, actor, `companyId`, effective date, reversal reference; balances as a
   **projection** updated in the same transaction as the movement insert.
3. Consumer: listener on `GoodsReceiptPosted` — in-process `@OnEvent` + RabbitMQ
   `@RabbitSubscribe` receiving the canonical `OutboxEnvelope` (broker target is
   `opts.broker` on the append, default rabbitmq — no routing table exists or is needed).
   Handler **must** wrap processing in `InboxPort.receive/complete/fail` (§1.9), keyed
   `(tenantId, companyId, consumer, envelope.eventId)`, then delegate to a use case —
   never logic inline.
4. Public contract `StockQueryPort` (`public/`) for future consumers (sales, accounting).
5. Tests: idempotent movement creation under redelivery; only accepted quantities enter
   stock; reversal produces compensating movement; balances reconcile to movement sum.

---

### Phase 6 — Events, side effects, docs polish

1. Remaining events/wire shapes from §F (anything not delivered in Phases 2–4).
2. Notification handlers per §1.8 (`PurchaseOrderIssued`, `GoodsReceiptPosted`) + bridge
   rows in `configure-notifications.ts` (**exception**).
3. Optional `CachePort` read-model caching (§1.6) if deferred from Phase 1.
4. `public/index.ts` JSDoc contracts updated for every new/changed cross-module shape.
5. Doc updates (**exceptions**): `ARCHITECTURE.md` §7 aggregate descriptions;
   `npm run docs:di` regeneration.
6. Full DoD pass against the spec's §15 checklist with evidence.

---

## C. Cross-cutting conventions (every phase, every PR)

- New tables/columns → header-comment table contracts in `.prisma` files, applied with
  `npm run db:push` (there is no migration folder); additive, backward-compatible,
  backfill-before-mandatory; never reinterpret historical rows.
- Every new use case: one file, `@Transactional()` on commands only, factory for
  construction, `pullEvents()` → integration port (existing `OutboxAdapter` pattern —
  unchanged shape), platform tokens only via ports.
- Every new DTO: one file, `createZodDto`; request/response DTOs separated;
  `@DeviceResponse` on read endpoints with different web/mobile shapes.
- Every state write: CAS/status-guarded (redelivery re-runs, never double-applies).
- Naming: `companyId` everywhere (global rename is done); stable envelope fields
  (`eventId`, `occurredAt`, correlation) are preserved end-to-end — listeners rely on it.
- Bounded failure: invalid transitions 422, conflicts/concurrency/idempotency-busy 409,
  missing/foreign rows 404 — nothing silently no-ops (Phase 0 removes the last one).
- Specs colocated (`*.spec.ts`), **inline fakes** (platform ships no doubles),
  `initNoopTransactionHost()` for `@Transactional()`.

## D. Verification battery (end of every phase — all green before proceeding)

```bash
npx tsc --noEmit -p tsconfig.json   # types (after schema change: npx prisma generate)
npm run lint:check                  # incl. architecture boundary rules
npm test                            # unit (fake-based, no DB)
npm run format:check                # prettier
npm run docs:di                     # ONLY when module providers changed (writes docs/ — exception)
# Phases 3–5 additionally, with docker compose up -d:
npm run test:e2e                    # must actually run; never reported green otherwise
```

## D2. Definition-of-Done pass (plan Phase 6.6) — spec §15 checklist with evidence

Evidence column: the file that implements the item, or the reason it is still open.

| # | Spec §15 item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Existing functionality audited and preserved | ✅ | §A audit recap; every A.1 item still in the code |
| 2 | PO and GRN lifecycles are explicit | ✅ | `purchase-order.invariants.ts` (`purchase-order.status-transition`), `grn.invariants.ts` (`grn.status-transition`) |
| 3 | Business invariants enforced outside the UI | ✅ | `invariantRegistry` / `policyRegistry`; `enforce()` throws on an unknown key, so a guard cannot silently no-op |
| 4 | Partial receipts and multiple receipts per PO | ✅ | `register-purchase-order-receipt.usecase.ts` + `PurchaseOrderReceiptRequest` (one entry per posting) |
| 5 | Over-receipt policy is configurable | ✅ | `purchase-order.over-receipt` policy; tolerance from `company_configs.overReceiptTolerance` (default 0.1) |
| 6 | Stock movements traceable and idempotent | ✅ | `inventory_movements @@unique([grnLineId, movementType])`; `goods-receipt-posted.consumer.ts` wraps the handler in `InboxPort.receive/complete/fail` |
| 7 | Concurrent receiving is safe | ✅ | CAS on `(id, version)` in the PO command repo. **Proven** by `test/receiving-concurrency.e2e-spec.ts` — two concurrent posts, exactly one wins, the balance records one receipt |
| 8 | Posted transactions cannot be silently changed | ✅ | `grn.editable` → DRAFT only; `purchase-order.editable` → DRAFT only; a posted GRN is corrected by a reversal |
| 9 | Reversals preserve historical records | ✅ | `reverse-grn.usecase.ts` creates a compensating document (`reversalOfId`); the original rows are never mutated |
| 10 | Approval and authorization rules are tested | ⚠️ | Approval **policy** implemented and enforced (409 above the threshold). **Authorization** is the IAM build (`docs/IAM-BUILD-PLAN.md`) — not implemented, and the unit suite is not in the repo |
| 11 | Domain events persisted and delivered reliably | ✅ | Transactional outbox (`outbox_messages`), `FOR UPDATE SKIP LOCKED` claim, `DEAD_LETTER` parking, broker choice per envelope |
| 12 | Supplier bill matching follows explicit policies | ❌ | Out of the agreed scope: workstream **H** (AP / three-way matching) is explicitly deferred — there is no AP module |
| 13 | Database migrations preserve existing data | ✅ | The project has **no** migration folder: the schema folder is the contract and `npm run db:push` syncs it. Additive changes only, backfilled before mandatory |
| 14 | Integration tests cover rollback, retries and concurrency | ⚠️ | Concurrency and idempotent-replay are covered by the e2e suite (5 tests). Rollback and retry coverage of the unit suite is not in the repo |
| 15 | Operational reconciliation and failure monitoring | ⚠️ | The platform provides outbox `DEAD_LETTER` + per-service reconciler crons and a `/metrics` endpoint. **PO↔receipt and stock↔ledger reconciliation jobs do not exist** |

**Result: 9 met, 4 partial, 2 open.** The two open items (12, 15) are the deferred
AP/inventory-reconciliation scope, not defects in the purchasing module.

### Still open against the spec (beyond the agreed plan scope)

These are in `update/BusinessAggregate.md` but were never in the plan's scope
(workstreams **H**, **E**) — they are new features, not gaps in what was built:

- `AmendPurchaseOrder` command + `PurchaseOrderAmended` event (spec §4, §8) — PO-06
  currently means "an issued PO cannot be amended at all".
- GRN `UpdateGoodsReceiptDraft` / `SubmitGoodsReceipt` / `ApproveGoodsReceipt`
  (spec §5 command list) — the code uses `receive` in place of `submit`, and GRN
  approval is not modelled.
- `CreateSupplierReturn` + `SupplierReturnPosted` (spec §5, §10) — deferred by
  decision E-5.
- `InspectionPolicy`, `ClosurePolicy`, `MatchingPolicy`, `AccountingPeriodPolicy`
  (spec §7) — only Approval, OverReceipt, Cancellation and Supplier exist.
- Tables `receipt_inspections`, `supplier_returns`, `approval_records` (spec §12) —
  approval data lives as columns on the PO instead of a separate table.
- **Tenant scoping of the business tables** — `purchase_orders`,
  `good_receipt_notes`, `products`, `vendors` and `invoices` carry no
  `tenantId`/`companyId` and the business query repositories never call
  `TenantScope`. This is the deliberate IAM deferral (`docs/IAM-BUILD-PLAN.md`),
  not an oversight, but it must be closed when IAM lands.

## E. Pending decisions (blocking — implementation does not start until answered)

| #    | Decision                                                                                        | Recommendation                                                      |
| ---- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| E-1  | Add `ISSUED` as a mandatory step vs keep the current 6 statuses                                 | Add `ISSUED` (spec-aligned); `complete` delegates to explicit close |
| E-2  | One-line-per-product merge (current, import-idempotency-backed) vs spec multi-line `lineNumber` | Keep merge; document deviation                                      |
| E-3  | Approve flagged §0.3 exceptions (schema/migrations, eslint, bootstrap bridge, docs) per phase   | Approve schema+migrations; decide bootstrap/docs separately         |
| E-4  | Actor columns (`createdBy`…) now (nullable) vs defer until IAM build                            | Add nullable now; backfill nothing                                  |
| E-5  | Scope: phases 0–3 only, or include reversal (4) and inventory (5)                               | 0–3 now; 4–5 scheduled after                                        |
| E-6  | Update `ARCHITECTURE.md`/docs with the phases or keep docs untouched                            | Update at Phase 6 only                                              |
| E-7  | Idempotency style: programmatic `IdempotencyPort` vs `@Idempotent()` controller decorator       | Programmatic port                                                   |
| E-8  | Over-receipt tolerance source: module policy constant vs `company_configs` extension            | Constant now; company override later                                |
| E-9  | `CachePort` read-model caching now vs defer                                                     | Defer to Phase 6                                                    |
| E-10 | Notification bridge rows in `src/bootstrap/configure-notifications.ts`                          | Approve at Phase 6                                                  |
