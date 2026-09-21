# Platform — Inbox Service

## Purpose

The Inbox is the **consumer-side counterpart of Outbox**. Where Outbox protects
reliable publication (write → publish is atomic), Inbox protects reliable
consumption (receive → process → ack is safe against duplicate delivery).

Every inbound message is claimed via **INSERT-as-claim** on the natural key
`(tenantId, organizationId, consumer, messageId)`. A successful insert means
the caller owns the message; a constraint violation means it has already been
claimed, processed, or is in progress.

## API

| Method | Port | Description |
|--------|------|-------------|
| `receive` | `InboxPort` | Try to claim an inbound message. Returns `ACQUIRED`, `PROCESSED`, `IN_PROGRESS`, `FAILED`, `SUSPENDED`, or `MESSAGE_REUSED`. |
| `complete` | `InboxPort` | Mark the reservation as `PROCESSED` (CAS with claim token + version). |
| `fail` | `InboxPort` | Mark the reservation as `FAILED` — allows retry (CAS with claim token + version). |

## Layout

```
inbox/
├── inbox.types.ts            # Identity, requests, results, InboxMessage, config
├── inbox.service.ts          # Service facade → implements InboxPort
├── inbox.module.ts           # DI module (NOT global)
├── inbox-reconciliation.ts   # Cron: release expired claims
├── inbox.spec.ts             # Integration tests
├── ports/
│   ├── inbox.port.ts         # Public port (business modules consume this)
│   └── inbox-repository.port.ts  # Repository port (internal)
├── usecases/
│   ├── receive-inbox-message.usecase.ts  # Claim via INSERT-as-claim
│   ├── complete-inbox-message.usecase.ts # CAS → PROCESSED
│   ├── fail-inbox-message.usecase.ts     # CAS → FAILED
│   └── claim-inbox-retry.usecase.ts      # Re-claim FAILED messages
├── repositories/
│   └── prisma-inbox.repository.ts   # PostgreSQL implementation
├── __testing__/
│   └── in-memory-inbox.repository.ts   # Test double
└── README.md
```

## Who calls how

| Caller | How |
|--------|-----|
| Business message consumers (e.g., order-event-handler) | Import `PlatformModule` → inject `InboxPort` → call `receive` before processing, `complete` on success, `fail` on error |
| `InboxReconciler` (cron) | Injects `InboxRepositoryPort` → releases expired `IN_PROGRESS` claims |
| Workers | Call `receive` as the first step of message processing, wrapping the result in `RequestContextPort.run` |

## Data

- **Table**: `inbox_messages`
- **Natural key**: `(tenantId, organizationId, consumer, messageId)` — unique
- **Status machine**: `IN_PROGRESS` → `PROCESSED` | `FAILED` → (re-claimable) | `SUSPENDED`
- **CAS**: Every state transition requires `claimToken` + `version` match
- **Expiration**: `IN_PROGRESS` claims older than `claimLeaseMs` are released by the reconciler

## Config

| Key | Default | Description |
|-----|---------|-------------|
| `INBOX_CLAIM_LEASE_MS` | 300000 (5 min) | How long a claim is valid before the reconciler releases it |
| `INBOX_MAX_ATTEMPTS` | 5 | Max retry attempts before SUSPENDED |
| `INBOX_RETRY_BASE_DELAY_MS` | 5000 | Base delay for exponential backoff |
| `INBOX_RETRY_MAX_DELAY_MS` | 600000 | Cap on retry delay |
| `INBOX_RECONCILIATION_INTERVAL_MS` | 60000 | How often the reconciler runs |
| `INBOX_BATCH_SIZE` | 100 | Max messages claimed per reconciliation cycle |

## Tenancy

The natural key `(tenantId, organizationId, consumer, messageId)` is
tenant-scoped. Different consumers process the same `messageId` independently.
`tenantId` defaults to `""` in single-tenant mode.

## Rules

1. Business modules consume **only** `InboxPort` — never `InboxRepositoryPort`
   or `PrismaInboxRepository`.
2. Every `complete` / `fail` is CAS-protected: `(claimToken, version, status)`.
3. Failed messages are re-claimable; the reconciler releases expired claims.
4. The module is **NOT global** — business modules opt-in via `PlatformModule`.
