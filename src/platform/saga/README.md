# Platform — Saga Process Orchestration Service

## Purpose

The Saga service coordinates business processes that span multiple aggregates,
modules, transactions, or asynchronous boundaries.

It answers: "Given this event, what should this company do next in this
configured business process?"

A Saga is **not** one large database transaction. It orchestrates a sequence
of steps, each dispatching a command to a business module, and reacts to
the resulting events.

## API

| Method | Port | Description |
|--------|------|-------------|
| `start` | `SagaPort` | Start a new saga instance from a trigger event |
| `handleEvent` | `SagaPort` | Handle an incoming event for an existing saga |
| `suspend` | `SagaPort` | Suspend a running saga instance |
| `compensate` | `SagaPort` | Trigger compensation for a failed step |

## Layout

```
saga/
├── saga.types.ts              # Types, status enums, DTOs, config
├── saga.service.ts            # Service facade → implements SagaPort
├── saga.module.ts             # DI module (NOT global)
├── saga.spec.ts               # Integration tests
├── ports/
│   ├── saga.port.ts           # Public port (business modules consume this)
│   ├── saga-repository.port.ts    # Repository port (internal)
│   └── saga-command.port.ts       # Command dispatch port
├── definitions/
│   └── saga-definition.ts     # In-memory definition registry
├── usecases/
│   ├── start-saga.usecase.ts          # Create instance + first step
│   ├── handle-saga-event.usecase.ts   # React to event + advance step
│   ├── suspend-saga.usecase.ts        # CAS → SUSPENDED
│   └── compensate-saga.usecase.ts     # Dispatch compensation command
├── repositories/
│   └── prisma-saga.repository.ts  # PostgreSQL implementation
├── reconciliation/
│   └── saga-reconciliation.ts     # Cron: release expired step claims
├── adapters/
│   ├── saga-event-consumer.adapter.ts    # Receives events from EventBus/MQ
│   └── saga-command-dispatcher.adapter.ts # Dispatches commands via ports
├── __testing__/
│   ├── in-memory-saga.repository.ts  # Test double
│   └── fake-saga-command.port.ts      # Fake command port
└── README.md
```

## Who calls how

| Caller | How |
|--------|-----|
| Event Bus / Message Queue | Delivers events to Saga consumer |
| Business module | Registers Saga definition/configuration |
| Saga Event Consumer | `SagaPort.handleEvent()` |
| Saga | `SagaCommandPort.dispatch()` |
| Business modules | Never imported directly |

## Configuration Model

### Saga Definition

A reusable process template:

```
SalesOrderFulfillmentSaga v1
```

### Company Saga Configuration

The organization's activation/customization of that process:

```
Company A — SalesOrderFulfillmentSaga v1 — enabled = true
Company B — SalesOrderFulfillmentSaga v1 — enabled = false
```

### Event Subscription

Which events the company wants the Saga to react to:

```
Company A — SalesOrderFulfillmentSaga
  SalesOrderCreated       ENABLED
  InventoryReserved       ENABLED
  InvoiceCreated          ENABLED
  PaymentReceived         ENABLED
```

## Data

- **Tables**: `saga_instances`, `saga_step_executions`, `saga_company_configs`,
  `saga_event_subscriptions`, `saga_step_configs`, `saga_compensation_configs`
- **Instance identity**: `(tenantId, organizationId, sagaType, correlationId)` — unique
- **Status machine**: `STARTED` → `RUNNING` → `WAITING` → `COMPLETED` | `COMPENSATING` → `COMPENSATED` | `SUSPENDED`
- **CAS**: Every state transition requires `claimToken` + `version` match

## Config

| Key | Default | Description |
|-----|---------|-------------|
| `SAGA_DEFAULT_TIMEOUT_MS` | 300000 | Default step timeout |
| `SAGA_DEFAULT_MAX_ATTEMPTS` | 5 | Default max retry attempts |
| `SAGA_RETRY_BASE_DELAY_MS` | 1000 | Base delay for exponential backoff |
| `SAGA_RETRY_MAX_DELAY_MS` | 600000 | Cap on retry delay |
| `SAGA_RECONCILIATION_INTERVAL_MS` | 60000 | How often the reconciler runs |
| `SAGA_STEP_CLAIM_LEASE_MS` | 60000 | Step claim lease duration |

## Tenancy

Every Saga record is scoped by `(tenantId, organizationId)`.
Company A must never see or mutate Company B's Saga instance.

## Rules

1. Saga is an **orchestrator**, not a business domain service.
2. Saga **never imports** business modules.
3. Saga communicates through **ports** only.
4. Saga definitions are **reusable** across companies.
5. Company configuration **determines** which Saga processes are enabled.
6. Company configuration **determines** which events a Saga consumes.
7. Company configuration **can override** timeouts and retry limits.
8. Global defaults must **never bypass** a company-level disable.
9. Every Saga instance is **tenant/company scoped**.
10. Retries must be **bounded** — exhausted processes become `SUSPENDED`.
11. Compensation is **not rollback** — it is a new business operation.
12. Workers **restore CLS** before executing tenant/company work.
13. The module is **NOT `@Global()`**.
