# Batch Operation — Inbound & Outbound Ports

Hexagonal map of every port under `src/platform/batch-operation`, who implements it, and who calls it. Wiring lives in `src/platform/platform.module.ts`.

## Inbound ports (driving)

Called **into** the batch pipeline (controller, worker, BullMQ consumer). Each port is an interface + Nest `Symbol` token; the use case is the implementation.

| Port token | Port file | Implementation | Implementation path | Called by |
|---|---|---|---|---|
| `CreateBatchOperationJobPort` | `ports/create-batch-operation-job.port.ts` | `CreateBatchOperationJobUseCase` | `usecases/create-batch-operation-job.usecase.ts` | `BatchOperationController` (`POST /batch-operations`) |
| `ValidateBatchOperationPort` | `ports/validate-batch-operation.port.ts` | `ValidateBatchOperationUseCase` | `usecases/validate-batch-operation.usecase.ts` | `BatchOperationController` (`POST /batch-operations/validate`) |
| `GetBatchOperationJobStatusPort` | `ports/get-batch-operation-job-status.port.ts` | `GetBatchOperationJobStatusUseCase` | `usecases/get-batch-operation-job-status.usecase.ts` | `BatchOperationController` (`GET /batch-operations/:id`) |
| `ListBatchOperationJobsPort` | `ports/list-batch-operation-jobs.port.ts` | `ListBatchOperationJobsUseCase` | `usecases/list-batch-operation-jobs.usecase.ts` | `BatchOperationController` (`GET /batch-operations`) |
| `ListBatchOperationJobRowsPort` | `ports/list-batch-operation-job-rows.port.ts` | `ListBatchOperationJobRowsUseCase` | `usecases/list-batch-operation-job-rows.usecase.ts` | `BatchOperationController` (`GET /batch-operations/:id/rows`) |
| `CancelBatchOperationJobPort` | `ports/cancel-batch-operation-job.port.ts` | `CancelBatchOperationJobUseCase` | `usecases/cancel-batch-operation-job.usecase.ts` | `BatchOperationController` (`POST /batch-operations/:id/cancel`) |
| `ProcessBatchOperationRowPort` | `ports/process-batch-operation-row.port.ts` | `ProcessBatchOperationRowUseCase` | `usecases/process-batch-operation-row.usecase.ts` | `BatchOperationWorker` (per row in a chunk) |

### DI wiring (inbound)

```ts
{ provide: CreateBatchOperationJobPort, useExisting: CreateBatchOperationJobUseCase }
{ provide: ValidateBatchOperationPort, useExisting: ValidateBatchOperationUseCase }
{ provide: GetBatchOperationJobStatusPort, useExisting: GetBatchOperationJobStatusUseCase }
{ provide: ListBatchOperationJobsPort, useExisting: ListBatchOperationJobsUseCase }
{ provide: ListBatchOperationJobRowsPort, useExisting: ListBatchOperationJobRowsUseCase }
{ provide: CancelBatchOperationJobPort, useExisting: CancelBatchOperationJobUseCase }
{ provide: ProcessBatchOperationRowPort, useExisting: ProcessBatchOperationRowUseCase }
```

---

## Outbound ports (driven)

Called **out** of the pipeline toward persistence, queue, outbox, or domain adapters.

| Port | Port file | Implementation | Implementation path | Notes |
|---|---|---|---|---|
| `BatchOperationJobRepositoryPort` | `ports/batch-operation-job-repository.port.ts` | `PrismaBatchOperationJobRepository` | `adapters/prisma-batch-operation-job.repository.ts` | Job header + `createJobWithRows` (header + Pending rows in one txn) |
| `BatchOperationJobRowRepositoryPort` | `ports/batch-operation-job-row-repository.port.ts` | `PrismaBatchOperationJobRepository` | same file as above | Same Prisma class implements both repo ports |
| `BatchOperationQueuePublisherPort` | `ports/batch-operation-queue-publisher.port.ts` | `BullMqBatchOperationQueuePublisher` | `adapters/bullmq-batch-operation-queue.publisher.ts` | Async chunk enqueue; Sync bypasses this and calls the worker in-process |
| `BatchOperationJobOutboxWriterPort` | `ports/batch-operation-job-outbox-writer.port.ts` | `PrismaBatchOperationJobOutboxWriter` | `adapters/prisma-batch-operation-job-outbox.writer.ts` | Writes `BatchOperationJobCompletedEvent` via `OutboxWriterPort` |
| `BatchOperationHandler` | `ports/batch-operation-handler.port.ts` | Per-aggregate adapter (e.g. `PurchaseOrderBatchOperationAdapter`) | Domain module, e.g. `src/business/procurement/purchase-order/infrastructure/adapters/platform/purchase-order-batch-operation.adapter.ts` | Registered by the owning module's `onApplicationBootstrap` on `BatchOperationHandlerRegistry` |

### DI wiring (outbound)

```ts
{ provide: BatchOperationJobRepositoryPort, useExisting: PrismaBatchOperationJobRepository }
{ provide: BatchOperationJobRowRepositoryPort, useExisting: PrismaBatchOperationJobRepository }
{ provide: BatchOperationQueuePublisherPort, useExisting: BullMqBatchOperationQueuePublisher }
{ provide: BatchOperationJobOutboxWriterPort, useExisting: PrismaBatchOperationJobOutboxWriter }
// BatchOperationHandler — not provided here; domain modules register adapters at boot
```

### Test doubles

| Port(s) | Test double | Path |
|---|---|---|
| Job + Row repository | `InMemoryBatchOperationJobRepository` | `__testing__/in-memory-batch-operation-job.repository.ts` |

---

## Related non-port files (call chain)

| Role | File | Path |
|---|---|---|
| HTTP driving adapter | `BatchOperationController` | `http/batch-operation.controller.ts` |
| Thin chunk loop | `BatchOperationWorker` | `batch-operation.worker.ts` |
| BullMQ consumer | `BullMqBatchOperationWorker` | `adapters/bullmq-batch-operation.worker.ts` |
| Stuck-row / orphan re-dispatch | `BatchOperationReconciliationConsumer` | `batch-operation-reconciliation.consumer.ts` |
| Handler registry | `BatchOperationHandlerRegistry` | `batch-operation-handler.registry.ts` |
| Prisma mapper | `BatchOperationMapper` | `adapters/batch-operation.mapper.ts` |
| Completed event | `BatchOperationJobCompletedEvent` | `events/batch-operation-job-completed.event.ts` |
| Queue name constants | `BATCH_OPERATION_QUEUE_NAME` | `adapters/bullmq-batch-operation.constants.ts` |

---

## Flow (who talks to which port)

```
Controller
  ├─ CreateBatchOperationJobPort      → CreateBatchOperationJobUseCase
  │     ├─ BatchOperationJobRepositoryPort
  │     ├─ BatchOperationHandlerRegistry → BatchOperationHandler
  │     ├─ BatchOperationWorker (Sync)  OR  BatchOperationQueuePublisherPort (Async)
  │     └─ NumberingPort (platform)
  ├─ ValidateBatchOperationPort       → ValidateBatchOperationUseCase
  ├─ GetBatchOperationJobStatusPort   → GetBatchOperationJobStatusUseCase
  ├─ ListBatchOperationJobsPort       → ListBatchOperationJobsUseCase
  ├─ ListBatchOperationJobRowsPort    → ListBatchOperationJobRowsUseCase
  └─ CancelBatchOperationJobPort      → CancelBatchOperationJobUseCase

BullMqBatchOperationWorker / Sync path
  └─ BatchOperationWorker.processChunk
        └─ ProcessBatchOperationRowPort → ProcessBatchOperationRowUseCase
              ├─ BatchOperationJobRepositoryPort
              ├─ BatchOperationJobRowRepositoryPort
              └─ BatchOperationHandler (via registry)
        └─ BatchOperationJobOutboxWriterPort (on job finalise)
```

All paths above are relative to `src/platform/batch-operation/` unless noted otherwise.
