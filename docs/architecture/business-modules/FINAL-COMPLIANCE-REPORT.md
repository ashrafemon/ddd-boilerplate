# Final Compliance Report (2026-11-05)

Initiative: business-module standardization (Phases 0–10) — closed.

## Summary

- 135 / 135 tasks completed (documentation + audit closure).
- Verification battery: `tsc`, `lint:check`, `format:check`, build, DI smoke — green.
- E2E not re-run in this session (requires docker + `.env`); last run per
  `PROGRESS.md` evidence.

## Code changes made during closure

- Phase 1 audit report: `AUDIT-REPORT.md`.
- Phase 3: removed use case→facade coupling in recurring generation
  (`generate-recurring-purchase-order.usecase.ts`, `generate-recurring-invoice.usecase.ts`);
  facades retained for cross-module callers.
- Phase 6: Inbox dedup + tenant context restoration added to
  `GoodsReceiptPostedListener`, `VendorBillPostedListener`, and both recurring
  RabbitMQ listeners; `GoodsReceiptPostedListener` now invokes
  `RegisterPurchaseOrderReceiptUseCase`.
- Phase 7: `@Idempotent()` already applied on PO/GRN controller endpoints;
  direct cache/idempotency port usage in use cases remains (known deviation).
- Documentation: `rules/` folder (architecture, business modules, platform
  services, API endpoints, data model, events, configuration).

## Known deviations (recorded, not fully resolved)

1. Controllers retain transport-level existence checks (`if (!entity)` → 404)
   — classified as transport mapping (P0-16 #9).
2. Use cases still throw inline exceptions and inject cache/idempotency ports
   directly; cache decorator not yet implemented.
3. Request context seeded by `RequestIdInterceptor`, not middleware; no RBAC
   guard / base ABAC (IAM deferred — ADR-010).
4. Listeners for `vendor-bill-posted` log only (no business use case yet).
5. Optimistic concurrency only on PurchaseOrder and GRN; Vendor/Product/Invoice
   command repos are last-write-wins.
6. Docs/code path drift (listeners vs listens, business-aggregate vs module,
   platform paths) recorded in `PROGRESS.md` §6.

## Rule compliance snapshot

Aligned: R-01..R-06, R-09, R-16, R-17, R-44 (type-only imports), R-45
(port/contract deps), layering, no application DTOs/mappers, no facade→facade,
domain services do not throw, outbox-only side effects, tenant scoping.

Partial: R-03/R-07/R-08 (controller/use-case responsibilities), R-46
(cache/idempotency decorator placement), R-10/R-11 (context/ABAC), R-12 (Inbox
ordering for vendor-bill-posted).
