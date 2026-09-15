# Batch Operation — Ports

Hexagonal map of every port under `src/platform/batch-operation`, who implements it, and who calls it. Wiring lives in `src/platform/platform.module.ts`.

Same convention as `platform/recurring`: `ports/` holds only genuine
outbound/plugin boundaries (persistence, queue, outbox, and the cross-module
handler contract), each with exactly one production implementation. The
controller and the worker inject the seven usecases directly — there is no
inbound port + adapter wrapper per usecase.

## Outbound ports (driven)

Called **out** of the pipeline toward persistence, queue, outbox, or domain adapters.

| Port                                 | Port file                                          | Implementation                                                    | Implementation path                                                                                                                      | Notes                                                                                         |
| ------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `BatchOperationJobRepositoryPort`    | `ports/batch-operation-job-repository.port.ts`     | `PrismaBatchOperationJobRepository`                               | `adapters/prisma-batch-operation-job.repository.ts`                                                                                      | Job header + `createJobWithRows` (header + Pending rows in one txn)                           |
| `BatchOperationJobRowRepositoryPort` | `ports/batch-operation-job-row-repository.port.ts` | `PrismaBatchOperationJobRepository`                               | same file as above                                                                                                                       | Same Prisma class implements both repo ports                                                  |
| `BatchOperationQueuePublisherPort`   | `ports/batch-operation-queue-publisher.port.ts`    | `BullMqBatchOperationQueuePublisher`                              | `adapters/bullmq-batch-operation-queue.publisher.ts`                                                                                     | Async chunk enqueue; Sync bypasses this and calls the worker in-process                       |
| `BatchOperationJobOutboxWriterPort`  | `ports/batch-operation-job-outbox-writer.port.ts`  | `PrismaBatchOperationJobOutboxWriter`                             | `adapters/prisma-batch-operation-job-outbox.writer.ts`                                                                                   | Writes `BatchOperationJobCompletedEvent` via `OutboxWriterPort`                               |
| `BatchOperationHandler`              | `ports/batch-operation-handler.port.ts`            | Per-aggregate adapter (e.g. `PurchaseOrderBatchOperationAdapter`) | Domain module, e.g. `src/business/procurement/purchase-order/infrastructure/adapters/platform/purchase-order-batch-operation.adapter.ts` | Registers itself (`aggregateType()`/`supportedOperations()` are its own metadata) on `BatchOperationHandlerRegistry` in its own `onApplicationBootstrap` — see README "Onboarding" |

### DI wiring (outbound)

```ts
{ provide: BatchOperationJobRepositoryPort, useExisting: PrismaBatchOperationJobRepository }
{ provide: BatchOperationJobRowRepositoryPort, useExisting: PrismaBatchOperationJobRepository }
{ provide: BatchOperationQueuePublisherPort, useExisting: BullMqBatchOperationQueuePublisher }
{ provide: BatchOperationJobOutboxWriterPort, useExisting: PrismaBatchOperationJobOutboxWriter }
// BatchOperationHandler — not provided here; each domain adapter self-registers
// on the registry in its own onApplicationBootstrap (see README "Onboarding")
```

### Test doubles

| Port(s)              | Test double                           | Path                                                      |
| -------------------- | ------------------------------------- | --------------------------------------------------------- |
| Job + Row repository | `InMemoryBatchOperationJobRepository` | `__testing__/in-memory-batch-operation-job.repository.ts` |

---

## Related non-port files (call chain)

| Role                           | File                                   | Path                                            |
| ------------------------------ | -------------------------------------- | ----------------------------------------------- |
| HTTP driving adapter           | `BatchOperationController`             | `http/batch-operation.controller.ts`            |
| Thin chunk loop                | `BatchOperationWorker`                 | `batch-operation.worker.ts`                     |
| BullMQ consumer                | `BullMqBatchOperationWorker`           | `adapters/bullmq-batch-operation.worker.ts`     |
| Stuck-row / orphan re-dispatch | `BatchOperationReconciliationConsumer` | `batch-operation-reconciliation.consumer.ts`    |
| Handler registry               | `BatchOperationHandlerRegistry`        | `batch-operation-handler.registry.ts`           |
| Prisma mapper                  | `BatchOperationMapper`                 | `adapters/batch-operation.mapper.ts`            |
| Completed event                | `BatchOperationJobCompletedEvent`      | `events/batch-operation-job-completed.event.ts` |
| Queue name constants           | `BATCH_OPERATION_QUEUE_NAME`           | `batch-operation.constants.ts`                  |

---

## Flow (who talks to which port)

```
Controller (injects usecases directly, no inbound port)
  ├─ CreateBatchOperationJobUseCase
  │     ├─ BatchOperationJobRepositoryPort
  │     ├─ BatchOperationHandlerRegistry → BatchOperationHandler
  │     ├─ BatchOperationWorker (Sync)  OR  BatchOperationQueuePublisherPort (Async)
  │     └─ NumberingPort (platform)
  ├─ ValidateBatchOperationUseCase
  ├─ GetBatchOperationJobStatusUseCase
  ├─ ListBatchOperationJobsUseCase
  ├─ ListBatchOperationJobRowsUseCase
  └─ CancelBatchOperationJobUseCase

BullMqBatchOperationWorker / Sync path
  └─ BatchOperationWorker.processChunk
        └─ ProcessBatchOperationRowUseCase (injected directly)
              ├─ BatchOperationJobRepositoryPort
              ├─ BatchOperationJobRowRepositoryPort
              └─ BatchOperationHandler (via registry)
        └─ BatchOperationJobOutboxWriterPort (on job finalise)
```

All paths above are relative to `src/platform/batch-operation/` unless noted otherwise.
