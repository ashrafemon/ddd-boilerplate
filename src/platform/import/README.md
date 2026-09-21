# import (`platform/import`)

Bulk spreadsheet/CSV import into any domain aggregate via a shared hexagonal
pipeline. Domains opt in by shipping a pure `ImportHandler` + descriptor that the
composition root (`src/bootstrap/configure-imports.ts`) registers on
`ImportHandlerRegistry` — the pipeline never imports domain types.

## Layout

```
ports/                             inbound + outbound abstract-class ports (import.ports.ts)
usecases/                          business logic only (import.usecases.ts) — implements no port
adapters/                          inbound port adapters (import-inbound.adapters.ts, one thin
                                   class per port, delegates to its usecase) + Prisma job/row/
                                   storage repos + outbox writer, BullMQ publisher + @Processor
events/                            ImportJobCompleted/Failed/Cancelled → outbox → RabbitMQ
import-handler.registry.ts · import-file.parser.ts (header detection, alias mapping,
structural checks) · import-reconciliation.consumer.ts (resumes orphaned stages via lock takeover; purges expired storage) ·
import.types.ts · import.errors.ts · import.constants.ts
http/                              generic /import routes + Zod request DTOs
```

## Messaging

| Plane       | Tech                 | Role                       |
| ----------- | -------------------- | -------------------------- |
| Work        | BullMQ `import.jobs` | parse → validate → execute |
| Integration | Outbox → RabbitMQ    | terminal job events        |

## Onboarding

```ts
// business/party/vendor/vendor.module.ts — PURE: no lifecycle, no registry import
@Module({ imports: [PlatformModule], providers: [VendorImportHandler, …] })
export class VendorModule {}

// src/bootstrap/configure-imports.ts — the bridge (same precedent as configure-batch-operations.ts)
export const IMPORT_ENTITIES: readonly ImportEntityOptIn[] = [
  {
    entityKey: 'vendor',
    descriptor: VENDOR_IMPORT_DESCRIPTOR,
    ownerModule: VendorModule,
    importHandler: VendorImportHandler,
  },
];
```

The handler is provided inside the domain module (its deps resolve there), but
registration happens in the composition root via strict `app.select(module).get(handler)`.
Adding an importable entity = one row in `IMPORT_ENTITIES`.

## Registered entities

| entityKey        | Handler                      | File shape                                                |
| ---------------- | ---------------------------- | --------------------------------------------------------- |
| `vendor`         | `VendorImportHandler`        | one row per vendor (`code`, `name`, …)                    |
| `purchase-order` | `PurchaseOrderImportHandler` | one row per **PO line**, grouped by `poReference` (below) |

**`purchase-order`** — columns `poReference`, `vendorCode`, `currency?`, `sku`,
`quantity`, `unitPrice`. Vendors/products are resolved by code/SKU (case-insensitive)
through the vendor/product public ports (one batch lookup per chunk); the file never
carries UUIDs. Rows sharing a `poReference` become one **DRAFT** PO, stored in
`purchase_orders.externalReference` (unique). Semantics worth knowing:

- Find-or-create by `poReference`, lines are _set_ (not summed): re-importing a
  corrected file, or a redelivered chunk, converges on the same PO with no duplicates.
- A PO whose lines straddle execution chunks is fine — later chunks add to the same PO.
- All rows of a PO within a chunk apply or fail together (one transaction per PO).
- A row is `INVALID` if its vendor/SKU is unknown or not orderable/purchasable, or its
  vendor/currency disagrees with earlier rows of the same PO, or repeats a `sku` within
  the same PO (detected within a validation chunk; across chunks the later row wins).
- Importing into a `poReference` whose PO is no longer DRAFT, or belongs to another
  vendor/currency, fails those rows (`FAILED`) with the reason in the report.

## HTTP

```
GET    /import/_registry
GET    /import/:entityKey/init
POST   /import/uploads
POST   /import/jobs
GET    /import/jobs
GET    /import/jobs/:id
GET    /import/jobs/:id/preview
PATCH  /import/jobs/:id/mapping
GET    /import/jobs/:id/report
POST   /import/jobs/:id/execute
POST   /import/jobs/:id/cancel
```

## Tenancy & rules

- Job + rows + storage objects are tenant-stamped; every read/preview/report
  path enforces `TenantScope` (foreign tenant ⇒ 404). Upload keys embed the tenant.
- A job may only reference an `IMPORT_SOURCE` storage object of the SAME tenant
  (cross-tenant `storageObjectId` is rejected as not-found) — the object id is a
  bearer token, so treat it as sensitive.
- The pipeline acquires a renewing job-level `StageLock` (from `platform/locking`)
  per async stage; the reconciler only resumes-orphaned stages under that same
  lock, so it never double-runs a live phase.
- Create/execute POST routes use `@Idempotent()` (`platform/idempotency`).
