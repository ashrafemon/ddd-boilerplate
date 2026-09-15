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
