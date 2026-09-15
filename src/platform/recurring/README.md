# Recurring (`platform/recurring`)

Owns **what** to generate and **when** (template + execution history).  
Scheduler owns only **wake-ups** (`scheduled_jobs`).

Document creation is **not** done in the Recurring handler. After a claimed,
eligible occurrence Recurring writes `RecurringOccurrenceRequested` to the
transactional outbox. Infrastructure publishes it to RabbitMQ; the owning
business module listens and creates the document.

## Two tables, one job

| Table                  | Role                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| `recurring_templates`  | Series config: party, `targetEntityType`, TIME/EVENT, lines, conditions       |
| `scheduled_jobs`       | Opaque wake-up for TIME only (`jobType=Recurring`, `aggregateId=template.id`) |
| `recurring_executions` | Per-firing idempotency + generated document snapshot                          |

## TIME flow

1. `POST /recurring-templates` (TIME) → template + `SchedulerPort.schedule` in one txn
2. `SchedulerTicker` claims due job → registry fires `Recurring` handler in-process
3. Handler (`@Transactional`): claim execution (insert-as-claim) → condition →
   **outbox** `RecurringOccurrenceRequested` → reschedule, all in one transaction
   (a crash rolls the whole occurrence back; a committed one never half-lands)
4. TIME series advance via the anchored engine + `SchedulerPort.rescheduleByAggregate`;
5. `OutboxPublisher` → RabbitMQ (`erp.events` / `RecurringOccurrenceRequested`)
6. PurchaseOrder (or Invoice) consumer creates the document and completes the execution

## EVENT flow

No `scheduled_jobs` row. `DomainEventDispatcher` matches ACTIVE templates by `eventName` and calls the **same** handler with `jobId: null`.

## Public API / inbound surface

- HTTP `/api/v1/recurring-templates` (create TIME/EVENT, list — status + page/limit, get, pause/resume/cancel).
- Inbound port `RecurringExecutionPort` (`complete` / `fail` / `skip`) — bound to
  `RecurringExecutionAdapter` — is how the document-creating consumer closes the loop.
- `RecurringGenerationHandler` self-registers with the scheduler at
  `onApplicationBootstrap`.

## Who calls it / how called

| Caller | How |
| --- | --- |
| `platform/scheduler` worker | fires `Recurring` jobType → `RecurringGenerationHandler.handle` (TIME) |
| `platform/recurring/DomainEventDispatcher` | `EventEmitter2.onAny` → same handler with `jobId: null` (EVENT) |
| business (PurchaseOrder/Invoice) Rabbit listeners | handle `RecurringOccurrenceRequested`, then call `RecurringExecutionPort.complete/fail` |
| ops | HTTP CRUD on `/recurring-templates` |

## Tenancy & rules
- Template owns tenancy (`@@unique([tenantId, templateNo])` — per-tenant number
  space, no cross-tenant probe); handler rejects a payload whose tenant
  disagrees with the template row.
- Numbering of generated docs and the resolver for any `generationCondition`
  field run under the tenant context; **condition fields require a
  `FieldResolver` registered by the owning business module** (see the
  condition-engine README) or evaluation throws.
- Executions are inserted as the idempotency key `(templateId, triggerKey)`;
  the hourly `SweepStaleExecutionsUseCase` fails IN_PROGRESS rows whose
  consumer never completed them (never auto-regenerates).
- State changes (pause/resume/cancel) write `AuditPort` rows.
