# Phase 1 — Business Module Audit Report

Read-only audit of business modules. Modules: `party/vendor`, `procurement/product`,
`procurement/purchase-order`, `procurement/good-receipt-note`, `sales/invoice`,
plus `shared-business` and schema-only `inventory/stock-movement`.

## P1-01 Module inventory

| Module | Context | Path |
| --- | --- | --- |
| vendor | party | `src/business/party/vendor` |
| product | procurement | `src/business/procurement/product` |
| purchase-order | procurement | `src/business/procurement/purchase-order` |
| good-receipt-note | procurement | `src/business/procurement/good-receipt-note` |
| invoice | sales | `src/business/sales/invoice` |
| shared-business | — | `src/business/shared-business` |
| stock-movement | inventory | schema only (`prisma/schema/inventory/stock-movement.prisma`); no `src/business/inventory` |

Module composers: `PartyModule`, `ProcurementModule`, `SalesModule`, aggregated by
`BusinessModule`.

## P1-02 Layer/folder structure

All five modules follow the canonical anatomy (domain/application/infrastructure/
presentation/public/module). Drift vs docs:
- Docs say `application/integrations/listeners/`; repo uses `listens/`.
- Docs say `infrastructure/adapters/module/`; repo uses `business-aggregate/` (and `external/`).
- No `public/index.ts` barrel; consumers import specific contract/port path.
- Platform paths: repo uses `platform/platform-common/*` and `platform/platform-organization/*`.

## P1-03 Controllers

Thinness: controllers mostly delegate to use cases, but contain transport-level
existence checks (`if (!entity)`) that throw 404:
- `product.controller.ts:68`
- `vendor.controller.ts:83`
- `grn.controller.ts:100`
- `purchase-order.controller.ts:168`
- `invoice.controller.ts:77`

Classify as transport mapping; candidate for Phase 3 (P3-01/P3-02).

## P1-04 Use cases

- Orchestration mostly good.
- Violations: use cases inject cache/idempotency ports directly (see P1-13).
- Use cases throw `ConflictException`/`NotFoundException`/`BadRequestException`
  inline (e.g. `create-purchase-order.usecase.ts`).
- Two use cases call facades: `generate-recurring-purchase-order.usecase.ts`,
  `generate-recurring-invoice.usecase.ts` (P3-08/P3-09).
- Request context: use cases call `companyConfig.getCompanyConfig()` and
  `requestContext` opportunistically; no uniform "context first" sequence
  (Phase 5).

## P1-05 Facades

No facade→facade calls. Facades implement `public/ports` and delegate to own
use cases/services. Aligned with R-16 (subject to Phase 3 review).

## P1-06 Type/event boundaries

- Type-only non-event imports from domain into application are used
  (`domain/types/...`, `domain/factories/...`, `domain/repositories/...`) —
  allowed per R-44.
- Event imports restricted to integration contracts; no domain event imports
  in non-domain layers observed.
- Runtime aggregate/entity/VO imports outside domain: factories/repos (allowed).

## P1-07 Domain services

- Services present in purchase-order (`open-quantity`, `approval`, `pricing`,
  `receipt`, `status`) and vendor (`orderability.policy`).
- No `throw` in `*.service.ts` (aligned with R-06).
- Calculations centralized in domain services (recent refactor 7052011).

## P1-08 Invariants/policies

- Invariants files: per aggregate + per VO. Policy files: approval, cancellation,
  over-receipt (PO); reactivation (product); orderability (vendor).
- Invariants/policies throw domain errors; services do not.
- Registry-based (`invariant.registry.ts`, `policy.registry.ts`).

## P1-09 Application DTOs/mappers

None in `application/**`. DTOs live in `presentation/http/requests|responses`.
Mappers live in `infrastructure/persistence/prisma/`. Aligned.

## P1-10 Incoming event integrations

- Only purchase-order and invoice have listeners.
- Listeners are log-only stubs; do not use Inbox or call use cases.
- Files: `goods-receipt-posted.listener.ts`, `vendor-bill-posted.listener.ts`,
  `recurring-occurrence-requested.rabbitmq.listener-event.ts` (PO) and
  `recurring-occurrence-requested.rabbitmq.listener-event.ts` (invoice).

## P1-11 Outgoing event integrations

- Publishers defined as ports: `purchase-order.publisher-port.ts`,
  `grn.publisher-port.ts`, `vendor.publisher-port.ts`.
- Outbox adapter implements them; use cases call `integrationEvent.send(...)`
  inside `@Transactional()`.
- Aligned with outbox pattern.

## P1-12 Inbox/duplicate handling

- `InboxPort` exists (`platform/platform-common/inbox`).
- No business listener calls it. Gap (Phase 6).

## P1-13 Cache/idempotency

- Direct port usage in 19 PO/GRN use cases (`ReadCachePort`/`CachePort`).
- `@Idempotent()` applied on 4 controller endpoints (PO create, GRN create/post/reverse).
- No cache decorator exists (platform cache has no decorator).
- Gap (Phase 7).

## P1-14 Middleware/context init

- Context seeded by `RequestIdInterceptor`, not middleware.
- Fields: requestId, correlationId, tenantId, companyId, userId, roles.
- Background restore via `requestContext.run(...)` (outbox re-dispatch, workers).

## P1-15 Tenancy/company config

- `purchase_orders`, `good_receipt_notes`, `products`, `vendors`, `invoices`
  carry tenantId/companyId.
- Company config fetched inside use cases (`companyConfig.getCompanyConfig()`).
- `TENANCY_MODE=single|multi`; multi is JWT-verified fail-closed.

## P1-16 RBAC/ABAC

- No RBAC guard beyond `TenancyAuthGuard`.
- No base ABAC context. IAM deferred (ADR-010).

## P1-17 Consolidated violations (prioritized)

High:
1. Listeners log only, no Inbox/use case (Phase 6).
2. Use cases inject cache/idempotency ports directly (Phase 7).
3. No RBAC guard / base ABAC; context via interceptor (Phase 5).
4. Two use cases call facades (Phase 3).

Medium:
5. Controllers contain transport existence checks (Phase 3).
6. Use cases throw inline exceptions; calculations possibly in use cases (Phase 3/4).
7. Optimistic concurrency only PO/GRN (vendor/product/invoice LWW).

Low:
8. Docs/code drift (paths, barrels) — documentation only.
