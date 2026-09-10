# Recurring (`platform/recurring`)

Owns **what** to generate and **when** (template + execution history).  
Scheduler owns only **wake-ups** (`scheduled_jobs`).

Document creation is **not** done in the Recurring handler. After a claimed,
eligible occurrence Recurring writes `RecurringOccurrenceRequested` to the
transactional outbox. Infrastructure publishes it to RabbitMQ; the owning
business module listens and creates the document.

## Two tables, one job

| Table | Role |
|-------|------|
| `recurring_templates` | Series config: party, `targetEntityType`, TIME/EVENT, lines, conditions |
| `scheduled_jobs` | Opaque wake-up for TIME only (`jobType=Recurring`, `aggregateId=template.id`) |
| `recurring_executions` | Per-firing idempotency + generated document snapshot |

## TIME flow

1. `POST /recurring-templates` (TIME) → template + `SchedulerPort.schedule` in one txn
2. `SchedulerTicker` claims due job → registry fires `Recurring` handler in-process
3. Handler: claim execution → condition → **outbox** `RecurringOccurrenceRequested`
4. Handler reschedules via `SchedulerPort.rescheduleByAggregate` (or completes series)
5. `OutboxPublisher` → RabbitMQ (`erp.events` / `RecurringOccurrenceRequested`)
6. PurchaseOrder (or Invoice) consumer creates the document and completes the execution

## EVENT flow

No `scheduled_jobs` row. `DomainEventDispatcher` matches ACTIVE templates by `eventName` and calls the **same** handler with `jobId: null`.

## Wiring

- Handler: RecurringModule injects `ScheduledJobHandlerRegistry` and registers `RecurringGenerationHandler` for jobType `'Recurring'` in its own `onApplicationBootstrap`
