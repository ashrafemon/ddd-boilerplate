# import (`platform/import`)

Bulk spreadsheet/CSV import into any domain aggregate via a shared hexagonal
pipeline. Domains opt in by registering on `ImportHandlerRegistry` from their own
module's `onApplicationBootstrap` — the pipeline never imports domain types.

## Layout

```
ports/                             inbound + outbound abstract-class ports
usecases/                          inbound port implementations (import.usecases.ts)
adapters/                          Prisma job/row/storage repos + outbox writer,
                                   BullMQ publisher + @Processor
events/                            ImportJobCompleted/Failed/Cancelled → outbox → RabbitMQ
import-handler.registry.ts · import-file.parser.ts (header detection, alias mapping,
structural checks) · import-reconciliation.consumer.ts (stale-job cron) ·
import.types.ts · import.errors.ts · import.constants.ts
http/                              generic /import routes + Zod request DTOs
```

## Messaging

| Plane | Tech | Role |
|---|---|---|
| Work | BullMQ `import.jobs` | parse → validate → execute |
| Integration | Outbox → RabbitMQ | terminal job events |

## Onboarding

```ts
@Module({ imports: [PlatformModule], providers: [VendorImportHandler] })
export class VendorModule implements OnApplicationBootstrap {
  constructor(
    private readonly importHandlers: ImportHandlerRegistry,
    private readonly vendorImportHandler: VendorImportHandler,
  ) {}

  onApplicationBootstrap(): void {
    this.importHandlers.register('vendor', VENDOR_IMPORT_DESCRIPTOR, this.vendorImportHandler);
  }
}
```

The handler is provided (and registered) inside the domain module — its deps
resolve there; no `ModuleRef` lookup anywhere.

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
