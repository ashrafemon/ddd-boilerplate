# Purchasing Upgrade — Phase Plan (PurchaseOrder + GoodReceiptNote)

> **STATUS: PLAN ONLY — NOTHING HERE IS IMPLEMENTED.** No phase starts without the
> owner's explicit go-ahead per phase (see §E Pending Decisions).
>
> **Source spec:** `update/BusinessAggregate.md` (repo root, untracked) — "ERP Purchasing
> Module — DDD Update Specification" (PO/GRN lifecycles, partial receipts, over-receipt,
> inventory integration, three-way matching).
>
> **Scope guard:** all work stays inside `src/business/**`. Anything outside that folder
> is listed in §0.2 as a **flagged exception** requiring separate explicit approval.
>
> **Precondition:** the design-alignment slices (§05 event bus emit-only, §06 message queue
> publish-only, §04 outbox single-port) are in flight in this working tree — they delete
> `domainEventRegistry`/`outboxEventRegistry` rehydration, `message-routing.policy.ts` and
> the consumer registry. This plan already assumes those **post-alignment shapes**: events
> flow as envelopes (`emit(envelope)` / `message.payload`), broker choice is per-envelope
> (`opts.broker` on outbox append, default rabbitmq), and there are **no rehydrator
> registry files** to create. Start purchasing phases only on a tree where that work is
> green (`tsc` + `lint:check` + `npm test`).

---

## 0. Ground rules

### 0.1 Architecture contract every phase must obey (from AGENTS.md / ARCHITECTURE.md)

- Aggregate is the **sole mutation path**: `domain/factories` (invariant-enforced) builds,
  `aggregate.pullEvents()` drains; domain folders import **no** `@nestjs/*`.
- Command use cases: `@Transactional()` → command repository port → outbox append — all in
  the **same DB transaction**. Query use cases: query port on `PrismaReadPort` (replica),
  never aggregates.
- **One use case per file** (`<verb>-<noun>.usecase.ts`), **one request DTO per file**
  (`presentation/http/requests/*.request.dto.ts`, zod via `createZodDto`), thin
  controllers that call use cases directly, `@DeviceResponse` for web/mobile variants.
- Invariants/policies live in the **keyed registries** (`invariantRegistry` /
  `policyRegistry`), registered via side-effect files imported by the factory.
- Cross-module calls only via another module's `public/**` (producer) + this module's
  `application/outbound-ports/**` + a consumer-side adapter
  (`infrastructure/adapters/module/`).
- Side effects that leave the process go through `OutboxWriterPort` (the module's
  integration-port adapter) inside the caller's transaction — never publish from a use case.
- Platform services are consumed as **exported port tokens** through
  `imports: [PlatformModule]` — never concrete classes, never raw clients, never by
  importing platform internals beyond the port token files.

### 0.2 Flagged exceptions (files OUTSIDE `src/business/` — need explicit approval each)

| Exception | Why it is unavoidable | Phases |
|---|---|---|
| `prisma/schema/procurement/purchase-order.prisma` + `good-receipt-note.prisma` and hand-written `prisma/migrations/<ts>_*` | Any new column/table/enum value (actor columns, `ISSUED` status, accepted/rejected qty, reversal link) is a table contract owned by the module's schema file | 2, 3, 4, 5 |
| `prisma/schema/inventory/*.prisma` (new) | The inventory ledger table contract for the new context | 5 |
| `eslint.config.mjs` `businessModules` entry | Required when adding the new `inventory` context module | 5 |
| `src/bootstrap/configure-notifications.ts` bridge rows | New `NotificationHandler` opt-ins are registered by the composition root (repo standard §9.1) | 6 |
| `npm run docs:di` output (`docs/DI-WIRING.md`) | Generated file; the script rewrites it whenever module providers change | any |
| `ARCHITECTURE.md` §7 / module README updates | Repo convention says docs move with the code | 6 |

If an exception is not approved, the phase delivers the code-side only and hands the owner
the exact SQL/config to apply manually.

---

## A. Audit recap (baseline — detailed evidence in the audit delivered with this plan)

### A.1 Already correct — preserve, do not rewrite

- Explicit PO transitions + DRAFT-only editing + has-lines + positive-qty invariants
  (`purchase-order.invariants.ts`); server-side totals via `Money` VO.
- Approval-threshold policy (`approval.policy.ts`) + `CompanyConfigPort.autoApproveThreshold`.
- Vendor orderability check on create; product purchasability check on add-line.
- Transactional outbox flow in both modules (`pullEvents()` → integration port →
  `OutboxWriterPort` inside `@Transactional()`).
- Idempotent `setLine()` used by the import flow; `externalReference` find-or-create.
- Cross-module `PurchaseOrderForGrnPort` + facade (foundation for receiving checks).
- Platform integrations already live: scheduler/recurring (PO templates), batch-operation
  (PO submit/approve/reject/cancel; GRN receive/complete, bridged from
  `src/bootstrap/configure-batch-operations.ts`), import (PO), notification handler for
  `PurchaseOrderApproved` (bridged from `src/bootstrap/configure-notifications.ts`).

### A.2 Bugs — fix before any feature work (Phase 0)

| # | Bug | Evidence |
|---|---|---|
| B1 | **GRN lines never persist.** `save`/`update` pass `lines` as a bare array (invalid Prisma relation syntax; needs `{ deleteMany:{}, create:[...] }` like the PO repo) and `findById` never `include: { lines: true }` although `PrismaGrnMapper.toDomain` maps `row.lines` | `prisma-grn-command.repository.ts`, `prisma-grn.mapper.ts` |
| B2 | **GRN editable after receipt.** `grn.editable` allows `['DRAFT','RECEIVED']`; lines can be added post-receipt | `grn.invariants.ts` |
| B3 | **Silent approve no-op.** Above-threshold `approve` is skipped — HTTP 200, nothing changes, no signal | `purchase-order-transition.usecase.ts` |
| B4 | **Race-prone numbering.** PO `nextOrderSequence()` = last-row arithmetic; GRN number = `GRN-${Date.now()}` in the factory (collision-prone); platform race-safe `NumberingPort` adapter exists in PO module but is **unused** | `prisma-purchase-order-command.repository.ts`, `grn.factory.ts` |
| B5 | **GRN ignores PO contents.** Create only checks PO *exists*; client-supplied vendor/qty/price never validated; receiving against DRAFT/REJECTED/CANCELLED PO possible | `create-grn.usecase.ts` |
| B6 | **No optimistic concurrency.** `version` columns exist but both repos do last-write-wins `update where { id }`; `addLine` read-modify-write loses updates | both command repos |
| B7 | **GRN money is raw numbers** (no `Money` VO); `receivedAt` stamped at creation; GRN `cancel()` has no use case/endpoint | `grn.aggregate.ts`, `grn.factory.ts` |

### A.3 Missing capability map (workstreams)

- **A** PO commercial fields (order date, expected delivery, description snapshot, actor stamps)
- **B** PO lifecycle: `ISSUED`, close, amendment, approval records, cancel blocked by receipts,
  derived receipt status
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

Each phase ends with §D verification green before the next starts. Phases are ordered so
**bugs die first**, then **platform behaviors land as the shared foundation**, then domain
features build on top.

### Phase 0 — Correctness baseline (no new features)

Goal: make the current model trustworthy. Mostly surgical fixes inside both modules.

1. **B1 — GRN persistence round-trip.**
   - Modify `good-receipt-note/infrastructure/persistence/prisma-grn-command.repository.ts`:
     `save` → `create({ data: {...toRow(grn), lines: { create: toLinesCreateInput(grn) } } })`;
     `update` → `deleteMany: {}` + `create` (mirror the PO repo shape);
     `findById` → `include: { lines: true }`.
   - Modify `prisma-grn.mapper.ts`: split header vs lines create-input (same split the PO
     mapper already has).
2. **B2 — Immutability.** `grn.invariants.ts`: `grn.editable` → `status === 'DRAFT'` only.
   Re-check `GrnBatchOperationAdapter.ALLOWED_FROM` maps still match.
3. **B7 — Money + receivedAt.** GRN lines/total go through the shared `Money` VO
   (`@business/shared-business/domain/common/value-objects/money`); `receivedAt` becomes
   nullable in props and is set by `receive()` only (schema nullable — **exception**).
4. **B4 — Numbering.** PO create switches from `repository.nextOrderSequence()` to the
   module's already-wired `NumberingPort` adapter (key `purchase-order.number`,
   `prefix 'PO-'`, `padding 8` — output stays `PO-00000001`). GRN gets the same pair:
   new `good-receipt-note/application/outbound-ports/numbering.port.ts` +
   `good-receipt-note/infrastructure/adapters/platform/numbering.adapter.ts` (copy PO's),
   factory receives `grnNumber` as **input** (factories never invent numbers), key
   `grn.number`. Seed each sequence above the current max existing number (migration note).
   Remove dead `nextOrderSequence`/`nextGrnSequence` repo helpers.
5. **B3 — Explicit approval.** `purchase-order-transition.usecase.ts`: when
   `requiresManualApproval(threshold)` is true, `approve` throws
   `ConflictException` (409, "manual approval required") instead of silently no-oping.
   (Real approver authority arrives with Phase 2's approval record.)
6. **B6 — Optimistic concurrency CAS.** Both command repos: `update()` becomes
   `updateMany({ where: { id, version }, data: { ..., version: { increment: 1 } } })`;
   zero affected rows → `ConflictException` (409 "concurrent modification"). Aggregate
   `version` is threaded from the row by the mappers (PO mapper already reads it — verify
   GRN mapper passes real version instead of literal `1`).
7. **B7 — GRN cancel exposure.** New `cancel-grn.usecase.ts` +
   `PATCH /grn/:id/cancel` + `CancelGrnDto` (one DTO file) + update batch adapter ops if
   cancel should be batchable (default: no).
8. **Tests.** New: `grn.aggregate.spec.ts` (line merge, receive/complete/cancel
   transitions, invariants), `prisma-grn.mapper.spec.ts` (round-trip incl. lines),
   use-case specs with inline fakes + `initNoopTransactionHost()` for create/add-line/
   receive/transition; update `purchase-order.aggregate.spec.ts` for CAS + explicit-approval
   behavior.

**Files touched:** both `infrastructure/persistence/*`, `grn.mapper.ts`, `grn.invariants.ts`,
`grn.factory.ts`, `grn.types.ts`, `create-grn.usecase.ts`, `purchase-order-transition.usecase.ts`,
`create-purchase-order.usecase.ts`, new GRN numbering port+adapter, new cancel use case +
controller route + DTO, both `<module>.module.ts` (provider additions), specs.
**Schema (exception):** `receivedAt` nullable.

---

### Phase 1 — Platform-service behaviors in the business modules  ← the phase requested

Goal: every platform primitive the repo mandates (`AGENTS.md` "Reuse the shared primitives")
is consumed by PO/GRN through the sanctioned shape. This phase is the **shared foundation**
Phase 2–4 build on (actor fields the audit needs, idempotency the posting needs, numbering
the lifecycle needs).

**Injection discipline used throughout (matches the existing DI graph):**

| Consumption style | When | Precedent in this repo |
|---|---|---|
| Module-local outbound port + `infrastructure/adapters/platform/` adapter | The platform capability carries **module semantics** (sequence keys, entity-specific rendering) | PO `numbering.port.ts` + `numbering.adapter.ts`, `company-config.adapter.ts`, `outbox.adapter.ts` |
| Direct injection of the **platform port token** (via `PlatformModule`) | Pure infrastructure seams with no module semantics | `PrismaReadPort` in query repos; `RequestContextPort`/`LoggerPort` in DI-WIRING for PO |

**Never:** concrete platform services, platform files beyond the port token, raw clients
(Prisma/ioredis/amqplib), `@nestjs/schedule` in business.

#### 1.1 `NumberingPort` — race-safe document numbers  *(completes Phase 0.4)*
- Keys: `purchase-order.number`, `grn.number` (per-tenant/company-namespaced by the platform
  service itself). Both adapters already/now exist; ensure every document-creating path uses
  them and nothing else invents numbers.
- Tests: create use case spec asserts the port is called with the right key/options.

#### 1.2 `RequestContextPort` — actor & tenant stamping
- Inject the platform port into: `purchase-order-transition.usecase.ts`,
  `create-purchase-order.usecase.ts`, `add/remove-purchase-order-line.usecase.ts`,
  `create-grn.usecase.ts`, `add-grn-line.usecase.ts`, `receive-grn.usecase.ts`,
  `complete-grn.usecase.ts`, new cancel/issue/close/post/reverse use cases.
- Pattern: `const actor = this.requestContext.get()?.userId` with an **explicit input
  override** (`input.actorId ?? ctx`) so background executions (batch/import/recurring
  workers that restore context via `run()`) stay correct — repo convention: "explicit
  tenant/actor inputs stay as overrides".
- Persisted into the new actor columns (Phase 2 schema, **exception**): `createdBy`,
  `approvedBy`, `rejectedBy`, `issuedBy`, `cancelledBy`, `receivedBy`, `postedBy`.
- `PrismaReadPort` stays the only read client for query repos (already true — do not regress).
- Tests: fake context; both paths (HTTP context present / worker override).

#### 1.3 `AuditPort` — same-transaction transition trail
- Direct token injection. Every state transition records inside its `@Transactional()`
  (audit row commits atomically with the change; platform enriches actor/tenant from CLS
  and redacts sensitive keys):
  `purchase-order.{approve,reject,cancel,issue,close}`, `grn.{receive,post,reverse,cancel}`
  — `audit.record({ action, entityType: 'PurchaseOrder'|'GoodReceiptNote', entityId, ... })`.
- Tests: fake `AuditPort`; assert one row per successful transition and **none** when the
  transition throws.

#### 1.4 `IdempotencyPort` — replay-safe costly commands
- Programmatic `reserve / complete / fail` (per `src/platform/idempotency/README.md`)
  wrapped **around** the `@Transactional()` work in:
  - `create-grn.usecase.ts` (scope `grn.create`)
  - Phase 3 `post-grn` / Phase 4 `reverse-grn` (scopes `grn.post`, `grn.reverse`)
- Key source: optional `idempotencyKey` field on the request DTO (client-supplied);
  semantics per README: `REPLAY` → return stored result, `BUSY` → 409,
  `KEY_MISMATCH` → 400, `fail()` on any exception (no parking lot).
- PO create is **already** idempotent via `externalReference` find-or-create (import path) —
  do not double-protect; document the divergence.
- Alternative (decision §E-7): controller-level `@Idempotent()` decorator instead — only if
  the decorator is confirmed exported for business use; default is the programmatic port.
- Tests: fake port — replay returns the original id; BUSY → `ConflictException`; failure
  path calls `fail()`.

#### 1.5 `DistributedLockPort` — deliberately NOT used (documented decision)
- The PO-07 receiving guard (Phase 3) is enforced by **row locks** (`SELECT … FOR UPDATE`
  on `purchase_order_lines` inside the joined CLS transaction): DB-native, crash-safe,
  no lease semantics. Adding a Redis lock there would duplicate a weaker guarantee.
- The port stays reserved for any future **non-transactional** critical section
  (fail-closed lease, owner token). Listed here so the choice is explicit, not an omission.

#### 1.6 `CachePort` — disposable read-model caching *(optional, decision §E-9)*
- If approved: a tiny query-side decorator around `get-purchase-order` / `get-grn`:
  key **only** via `cachePort.buildKey({ ...identity })` (never hand-written),
  `get<T>()` → on `HIT` return, on `MISS` load repo → `set(key, record, ttl)`;
  command use cases `delete(key)` after a successful save (documented pre-commit race is
  acceptable: cache is disposable, Postgres remains the source of truth, adapter is
  fail-open). Default TTL from `CACHE_DEFAULT_TTL_MS`.
- Do **not** cache list queries (pagination + filter explosion) in this pass.
- Tests: fake `CachePort`; HIT short-circuits the repo; MISS loads + stores; command
  invalidates; cache errors never fail the request.

#### 1.7 `CompanyConfigPort` — thresholds & tolerances
- Today: `defaultCurrency` + `autoApproveThreshold` (already consumed).
- Phase 3 adds **over-receipt tolerance** lookup through the same module-local outbound
  port shape. Default: a registered policy constant; company-specific override requires a
  `company_configs` column (**exception** — decision §E-8).

#### 1.8 `NotificationDispatchPort` — side effects via the existing bridge
- Precedent: `purchase-order-notification.adapter.ts` — a **pure `NotificationHandler`**
  (resolveRecipients/resolveModel only, no lifecycle) keyed to a domain event name and
  registered by `src/bootstrap/configure-notifications.ts` (**exception**, decision §E-10).
- Phase 6 adds: `PurchaseOrderIssued` handler (vendor email), `GoodsReceiptPosted` handler
  (warehouse/receiving recipient). Until the bridge rows are approved the handlers stay
  inert — that is the designed degradation, not a bug.

#### 1.9 `InboxPort` — consumer-side dedupe *(deferred with real listeners)*
- Current `*.listener-event.ts` files are template loggers. When any listener starts doing
  real work (Phase 6+), its handler must first `inbox.receive({ consumer, messageId: eventId })`
  and `complete`/`fail` around the delegated use case — at-least-once safety for free.
- No code change in phases 0–4; recorded here so nobody wires a real listener without it.

#### 1.10 Already integrated — verify only, change nothing
- **Outbox** (both modules, correct), **Scheduler/Recurring** (PO templates),
  **BatchOperation** (bridged; note: its adapters delegate to the single-record use cases,
  so every validation added in Phases 2–4 is inherited automatically — only
  `ALLOWED_FROM` status maps need review when statuses change), **Import** (PO; `setLine`
  stays the idempotency mechanism), **PrismaReadPort** (query repos), **Observability**
  (global interceptors already log requests; no per-use-case LoggerPort noise).

#### 1.11 Do-not list (all of Phase 1)
- ❌ import platform concrete classes (`*Service`, `*Repository`, adapters)
- ❌ hand-written cache keys, hand-rolled sequences, `Date.now()` document numbers
- ❌ audit/outbox writes outside the use case's transaction
- ❌ swallowing `ConflictException`s from CAS/idempotency — they are the API contract (409)
- ❌ touching `src/platform/**` to "make it fit" — if a platform gap appears, stop and ask

---

### Phase 2 — PO lifecycle to ERP shape

Goal: spec §3/§4 — explicit lifecycle with `ISSUED`, actor-stamped approvals, amendment
discipline, cancel guarded by receipts.

1. Status: add `ISSUED` to `PurchaseOrderStatus` (domain enum + Prisma enum, additive
   **exception**). Transitions: `APPROVED → ISSUED → COMPLETED`; keep `CANCELLED` from
   DRAFT/SUBMITTED/APPROVED; `REJECTED/CANCELLED/COMPLETED` terminal (decision §E-1 on
   strictness). Update `purchase-order.status-transition` invariant map + aggregate spec.
2. Commands (one use case each) + endpoints:
   `PATCH /purchase-orders/:id` (draft header update: expectedDeliveryDate, externalReference),
   `PATCH /purchase-orders/:id/lines/:productId` (draft line update — reuse `setLine`
   semantics), `POST :id/issue` (validates ≥1 line, APPROVED, not cancelled → `ISSUED`,
   event `PurchaseOrderIssued`, audit + actor `issuedBy`), `POST :id/close`
   (`ISSUED → COMPLETED` as an explicit close; keeps `complete` endpoint delegating to it
   for API compatibility — decision §E-1).
3. Approval record (minimal): `approvedBy`, `approvedAt`, `rejectedBy`, `rejectedAt`,
   `rejectionReason` columns (**exception**); `reject(reason)` stores the reason
   (no defaulting to the string `'Rejected'` silently at the HTTP layer).
4. **CancellationPolicy** (`domain/policies/cancellation.policy.ts`, keyed registry):
   cancel is blocked when the PO has posted receipts — needs a small GRN public port
   (e.g. `GrnForPurchaseOrderPort.hasReceipts(poId)`, consumer-side adapter in
   `infrastructure/adapters/module/`, GRN facade delegating to a new query use case).
5. Line identity: keep one-line-per-product merge semantics + `@@unique([purchaseOrderId,
   productId])` (import idempotency depends on it) — documented deviation from the spec's
   `lineNumber` model (decision §E-2).
6. Events: `PurchaseOrderIssued`, `PurchaseOrderClosed` — new domain event classes +
   integration wire shapes in `application/integrations/publishes/` only. **No rehydrator
   registry files** (the alignment removed `domainEventRegistry`; in-process listeners
   consume the envelope `message.payload`, not rehydrated event objects).
7. Tests: aggregate spec for the new transitions; use-case specs (issue preconditions,
   cancel blocked by receipts via fake port); updated batch `ALLOWED_FROM` review.

---

### Phase 3 — Receiving integrity (PO ↔ GRN) — the heart of the spec

Goal: spec §5/§6 (GRN rules 1–12, PO-07, GRN-01/02, concurrency invariant).

1. **GRN creation validates against the PO** (`create-grn.usecase.ts`):
   PO status must be receiving-eligible (Phase 2's `ISSUED`), `input.vendorId` must equal
   the PO's vendor, each line must reference a real PO line; `orderedQuantity` and
   `unitPrice` are **snapshotted from the PO line** (client values ignored; mismatch →
   422). The outbound `PurchaseOrderPort` gains whatever read shape this needs (extend
   `PurchaseOrderReference` in PO `public/contracts/` — producer-owned change).
2. **Accepted/rejected split** (GRN-01/02): `GrnLine` gains `acceptedQuantity` /
   `rejectedQuantity` (schema **exception**), invariant
   `received = accepted + rejected`, no double disposition; new command
   `record-inspection-result` can stay minimal (accept = received by default).
3. **Atomic receiving balance (PO-07)** — ownership-preserving design:
   GRN `post`/`receive` use case (its `@Transactional()`) calls a new **PO public port**
   `registerReceipt(poId, lines, actor)`; the consumer-side adapter delegates to a new PO
   use case that joins the same CLS transaction, loads the PO lines
   `SELECT … FOR UPDATE`, enforces
   `net_received + proposed <= ordered × (1 + tolerance)` per line
   (**OverReceiptPolicy**, keyed registry; tolerance from §1.7), writes the received-qty
   projection, and raises `PurchaseOrderReceiptRecorded`. PO owns the authoritative
   balance; GRN owns the receipt document; no cross-module table access.
4. Derived receipt status on the PO read model: `NOT_RECEIVED | PARTIALLY_RECEIVED |
   FULLY_RECEIVED` (computed, never manually set — spec §4).
5. Idempotent posting: the status guard (post only from `RECEIVED`) + unique
   `(grnLineId, movementType)` semantics make redelivery re-runnable, never double-applying;
   plus §1.4 `IdempotencyPort` for the HTTP command.
6. New reads: `GET /purchase-orders/:id/receipts`, `GET /purchase-orders/:id/remaining-quantities`
   (query use cases on `PrismaReadPort`).
7. Tests: use-case specs with fakes (over-receipt blocked, tolerance boundary, vendor
   mismatch, wrong PO status, accepted+rejected reconciliation); **integration/concurrency
   test** (docker e2e — two concurrent receipts cannot exceed the limit; run
   `npm run test:e2e` with `docker compose up -d`, not marked passing without running it).

---

### Phase 4 — Reversal & returns

Goal: spec §5.3/GRN-05/10/11 — posted documents are corrected, never edited.

1. `POST /grn/:id/reverse` (new use case, new DTO): only from `RECEIVED`/`POSTED`; creates
   a **compensating reversal document** referencing the original
   (`reversalOfId` column, schema **exception**) with negative/mirrored quantities; never
   mutates the original rows. Calls PO `registerReceipt`-style port with a reversal entry
   (balance returns); events `GoodsReceiptReversed` (+ wire shape + registry); audit +
   actor `postedBy/reversedBy` (§1.3).
2. Optional minimal `create-supplier-return` — or explicitly deferred (decision §E-5).
3. Tests: reversal preserves history, cannot exceed original eligible quantity, idempotent
   under redelivery, PO balances reconcile.

---

### Phase 5 — Inventory context (new business module — optional, decision §E-5)

Goal: spec §9 — authoritative movement ledger, no balance-without-movement.

1. New context `src/business/inventory/stock-movement/` cloned from the `product` reference
   layout (domain/application/infrastructure/presentation/public + module file), added to
   `businessModules` in `eslint.config.mjs` (**exception**).
2. Table `inventory_movements` (**exception**): item, quantity (+base qty), movement type,
   source document + line (`@@unique([grnLineId, movementType])` = natural idempotency),
   from/to location, actor, effective date, reversal reference; balances as a **projection**
   updated in the same transaction as the movement insert.
3. Consumer: listener on `GoodsReceiptPosted` (outbox → in-process + broker; broker target
   is chosen per envelope via the outbox append `opts.broker`, default rabbitmq — the
   routing-table era is over, nothing platform-side to edit), wrapped per §1.9 with
   `InboxPort` before real processing; the handler delegates to a use case, never logic
   inline.
4. Public contract `StockQueryPort` (`public/`) for future consumers (sales, accounting).
5. Tests: idempotent movement creation under redelivery; only accepted quantities enter
   stock; reversal produces compensating movement; balances reconcile to movement sum.

---

### Phase 6 — Events, side effects, docs polish

1. Remaining events/wire shapes/registry entries from §F (anything not delivered in 2–4).
2. Notification handlers per §1.8 (`PurchaseOrderIssued`, `GoodsReceiptPosted`) + bridge
   rows (**exception**).
3. Optional `CachePort` read-model caching (§1.6) if deferred from Phase 1.
4. `public/index.ts` JSDoc contracts updated for every new/changed cross-module shape.
5. Doc updates (**exceptions**): `ARCHITECTURE.md` §7 aggregate descriptions, platform
   README rows if any consumption pattern changed, `npm run docs:di` regeneration.
6. Full DoD pass against the spec's §15 checklist, item by item, with evidence.

---

## C. Cross-cutting conventions (every phase, every PR)

- New tables/columns → header-comment table contracts in the `.prisma` files; hand-written
  SQL in `prisma/migrations/<ts>_<name>/migration.sql`; additive, backward-compatible,
  backfill-before-mandatory; never reinterpret historical rows.
- Every new use case: one file, `@Transactional()` on commands only, factory for
  construction, `pullEvents()` → integration port, platform tokens only via ports.
- Every new DTO: one file, `createZodDto`, request + response DTOs separated;
  `@DeviceResponse` on read endpoints returning different web/mobile shapes.
- Every state write: CAS/status-guarded (redelivery re-runs, never double-applies).
- Bounded failure: invalid transitions are 422, conflicts/concurrency/idempotency-busy are
  409, missing/foreign rows are 404 — nothing silently no-ops (Phase 0 removes the last
  silent no-op).
- Specs colocated (`*.spec.ts` next to the file), inline fakes (no platform test doubles),
  `initNoopTransactionHost()` for `@Transactional()`.

## D. Verification battery (end of every phase — all green before proceeding)

```bash
npx tsc --noEmit -p tsconfig.json   # types (after any schema change: npx prisma generate)
npm run lint:check                  # incl. architecture boundary rules
npm test                            # unit (fake-based, no DB)
npm run format:check                # prettier
npm run docs:di                     # ONLY when module providers changed (writes docs/ — exception)
# Phases 3–5 additionally, with docker compose up -d:
npm run test:e2e                    # must actually run; never reported green otherwise
```

## E. Pending decisions (blocking — implementation does not start until answered)

| # | Decision | Recommendation |
|---|---|---|
| E-1 | Add `ISSUED` as a mandatory step vs keep the current 6 statuses | Add `ISSUED` (spec-aligned); `complete` endpoint delegates to explicit close |
| E-2 | One-line-per-product merge (current, import-idempotency-backed) vs spec multi-line `lineNumber` model | Keep merge; document deviation |
| E-3 | Approve the flagged §0.2 exceptions (schema/migrations, eslint, bootstrap bridge, docs) per phase | Approve schema+migrations; decide bootstrap/docs separately |
| E-4 | Actor columns (`createdBy`…) now (nullable) vs defer until IAM build | Add nullable now; backfill nothing |
| E-5 | Scope: phases 0–3 only, or include reversal (4) and inventory (5) | 0–3 now; 4–5 scheduled after |
| E-6 | Update `ARCHITECTURE.md`/docs with the phases or keep docs untouched | Update at Phase 6 only |
| E-7 | Idempotency style: programmatic `IdempotencyPort` in use cases vs `@Idempotent()` controller decorator | Programmatic port (README's business-side pattern) |
| E-8 | Over-receipt tolerance source: module policy constant vs `company_configs` extension | Constant now; company override later |
| E-9 | `CachePort` read-model caching now vs defer | Defer to Phase 6 |
| E-10 | Notification bridge rows in `src/bootstrap/configure-notifications.ts` | Approve at Phase 6 |
