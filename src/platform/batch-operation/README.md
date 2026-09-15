# batch-operation

Run one operation across many selected records as a single tracked unit
(bulk submit / approve / reject / cancel / …) with per-row success / failure.
Adapted from `FlexSuite_Batch_Operation_Service_Map-NestJS-v1` — a job/rows
fan-out pipeline crossing into a domain core at exactly one point, the adapter.

## Shape

Flat platform-service layout — same convention as `platform/recurring`: root
classes + `events/`, `http/`, `ports/`, `usecases/`, `adapters/`,
`__testing__/`. No business-module DDD layering (no `domain/` or
`application/` folders) — this module has no aggregate.

```
root
  batch-operation.module.ts             DI wiring
  batch-operation-handler.registry.ts   Map<aggregateType, handler> + boot validation + health
  batch-operation.worker.ts             thin chunk loop → ProcessBatchOperationRowUseCase
  batch-operation-reconciliation.consumer.ts   @Cron: fence+reset stuck PROCESSING, recount counters, finalise settled jobs, re-enqueue PENDING
  batch-operation.types.ts · batch-operation.errors.ts · batch-operation.constants.ts
usecases/    business logic only, one class per capability, injected directly
             by the controller/worker — no per-usecase port+adapter wrapper
  create-batch-operation-job.usecase.ts    guards, mode decision, job+rows txn, dispatch
  process-batch-operation-row.usecase.ts   claim → validate → execute → record → progress
  validate-batch-operation.usecase.ts      dry-run preview
  get-batch-operation-job-status.usecase.ts
  list-batch-operation-jobs.usecase.ts
  list-batch-operation-job-rows.usecase.ts
  cancel-batch-operation-job.usecase.ts
ports/   only genuine outbound/plugin boundaries — persistence + the
         cross-module handler contract, each with exactly one production adapter
  batch-operation-handler.port.ts           implemented by each opted-in aggregate module
  batch-operation-job-repository.port.ts
  batch-operation-job-row-repository.port.ts
  batch-operation-queue-publisher.port.ts
  batch-operation-job-outbox-writer.port.ts
adapters/
  prisma-batch-operation-job.repository.ts   Prisma job+row repo (implements both repo ports)
  prisma-batch-operation-job-outbox.writer.ts
  bullmq-batch-operation-queue.publisher.ts
  bullmq-batch-operation.worker.ts           @Processor — Async path only
  batch-operation.mapper.ts
events/ · __testing__/
http/
  POST /batch-operations · POST /batch-operations/validate ·
  GET /batch-operations · GET /batch-operations/:id · GET /batch-operations/:id/rows ·
  POST /batch-operations/:id/cancel · GET /batch-operations/_registry
```

## Onboarding a batch-capable aggregate

All opt-in code is pure data in the aggregate's own adapter (no registry
imports, no lifecycle hooks) plus one row in the composition-root bridge —
the module file stays a pure `@Module` declaration, so a generated template
can emit it unchanged:

```ts
// <aggregate>/infrastructure/adapters/platform/<aggregate>-batch-operation.adapter.ts
@Injectable()
export class PurchaseOrderBatchOperationAdapter implements BatchOperationHandler {
  constructor(/* own use cases */ ) {}
  aggregateType(): string { return 'PurchaseOrder'; }
  supportedOperations(): string[] { return ['submit', 'approve', 'reject', 'cancel']; }
  // validate()/execute() delegate to the aggregate's own single-record use cases
}
```

```ts
// procurement/purchase-order.module.ts — no class body, no registration code
@Module({
  imports: [PlatformModule],
  providers: [PurchaseOrderBatchOperationAdapter, /* ... */],
})
export class PurchaseOrderModule {}
```

```ts
// src/bootstrap/configure-batch-operations.ts — the bridge (adds one row)
export const BATCH_OPERATION_AGGREGATES = [
  { ownerModule: PurchaseOrderModule, batchHandler: PurchaseOrderBatchOperationAdapter },
];
```

The adapter is a thin router: `validate()` is a pure check of the record's
current state; `execute()` delegates to the aggregate's **own existing**
single-record service method inside that method's transaction — a record moved
via a batch is indistinguishable from one moved by hand. See
`src/business/procurement/purchase-order/infrastructure/adapters/platform/purchase-order-batch-operation.adapter.ts`.

## Codebase adaptations vs the design doc

| Design doc                                | Here                                                                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeORM                                   | Prisma via `TransactionHost`                                                                                                                                     |
| `BatchOperationModule.forRoot/forHandler` | providers live in `batch-operation.module.ts`; business modules ship PURE handlers and the composition-root bridge (`src/bootstrap/configure-batch-operations.ts`) registers them at boot |
| `job_no` generator                        | `NumberingPort` sequence `batch-operation-job`, prefix `BATCH-`                                                                                                  |
| BullMQ chunk queue                        | `BullMqBatchOperationQueuePublisher` + `BullMqBatchOperationWorker` (same pattern as scheduler); Sync still calls `BatchOperationWorker.processChunk` in-process |
| Job-completed notification                | `BatchOperationJobOutboxWriterPort` → transactional outbox                                                                                                       |

## Not yet built (design "OPEN" items)

Per-row permission re-check, heterogeneous (multi-aggregate) jobs, retry-failed-rows
as a new job, result_snapshot retention purge, WebSocket/SSE progress push, undo.


## Tenancy & rules

- Tenant-stamped; foreign-tenant reads 404 via TenantScope.
- Cancel honored between row claims; multi mode requires a tenant at submit.
- Handlers must tenant-check entity resolution.
