# Platform Services — Implemented

Platform code lives under `src/platform`. Business modules consume these only
through injected port tokens via `imports: [PlatformModule]`.

## platform-common

| Service | Purpose |
| --- | --- |
| audit | Writes `audit_logs` rows inside caller's DB transaction; redacts secrets; actor from context. |
| batch-operation | Run one operation across many records as tracked unit with per-row success/failure; reconciliation cron. |
| cache | Redis key-value speed layer (`CachePort`); never source of truth. |
| condition-engine | Declarative AND/OR generation gate evaluated sandboxed. |
| context | Request context (`RequestContextPort`) + tenancy auth guard + read-replica port. |
| currency-conversion | Currency rate port/adapter. |
| data-retention | Retention policies. |
| document-generation | Document/PDF generation. |
| events | In-process dispatch only (EventEmitter2 wrapper over canonical envelope). |
| event-sourcing-store | Event sourcing store. |
| export | Data export. |
| feature-flag | Feature flags. |
| file-management | File management. |
| governance | Governance. |
| idempotency | Claim ledger + Redis replay cache; `@Idempotent()` decorator. |
| identity | Identity. |
| import | Bulk spreadsheet/CSV import pipeline via `ImportHandler` opt-in. |
| inbox | Consumer-side dedup (INSERT-as-claim, CAS complete/fail). |
| integration | Integration adapters. |
| locking | Redis distributed lock with fencing tokens. |
| messaging | One port, broker by param (RabbitMQ/Kafka/SQS). |
| notification | Email/SMS/Push via providers; delivery receipts. |
| numbering | Gap-tolerant, race-safe, per-tenant document numbers. |
| observability | Logging, Prometheus metrics, Sentry. |
| outbox | Transactional outbox (append in tx, claim+publish, retry/DLQ). |
| rate-limitting | Rate limiting. |
| recurring | Recurring templates + execution history; emits occurrence requested. |
| scheduler | Centralized TIME-trigger bookkeeping (`scheduled_jobs`). |
| secret-management | Secret management. |
| storage | S3/local object storage (`FileStoragePort`). |
| subscription | Subscription. |
| tax | Tax calculation. |
| tenancy | Tenancy resolution. |
| webhook | Inbound receipt + outbound delivery of webhooks. |

## platform-organization

| Service | Purpose |
| --- | --- |
| aggregate-entitlement | Aggregate entitlement. |
| authorization | Authorization (RBAC/ABAC scaffolding; IAM deferred). |
| automation | Automation. |
| branch | Branch. |
| branch-department-relationship | Branch-department links. |
| branch-plant-relationship | Branch-plant links. |
| branch-warehouse-relationship | Branch-warehouse links. |
| configuration | Company config (`CompanyConfigPort`). |
| custom-fields | Custom fields. |
| dashboard | Dashboard. |
| department | Department. |
| entitlements | Entitlements. |
| global-search | Global search. |
| language-wise-label | i18n labels. |
| localization | Localization. |
| organization | Organization. |
| plant | Plant. |
| reporting | Reporting. |
| rules | Rules (scaffold only: empty `RulesModule`, `RulesPort`). |
| saga | Company-configurable orchestration (plan build/route/advance). |
| sdui-metadata | SDUI metadata. |
| warehouse | Warehouse. |
| workflow | Workflow. |

## platform-ai

| Service | Purpose |
| --- | --- |
| chat | AI chat. |
| gateway | AI gateway. |
| mcp | MCP integration. |
| registry | AI registry. |

## Key invariants (platform)

- Every owned table tenant-scoped (`tenantId String?`) where applicable;
  reads enforce `TenantScope.assertVisible` (foreign ⇒ 404).
- Claims idempotent: `FOR UPDATE SKIP LOCKED` (lease + reconcile cron) or
  insert-as-claim on unique key; state writes CAS/token-fenced.
- Reuse shared primitives; bounded retries with parked states
  (`FAILED`/`SUSPENDED`/`DEAD_LETTER`); every background state has a
  reconciler cron.
- File pattern: one use case per file, one request DTO per file, ports as
  abstract classes, `useExisting` providers, no `@Global()`.

## Reference

Each service has its own `src/platform/<x>/README.md` with purpose/API/layout/
who-calls-how/data/config/tenancy/rules. See those for authoritative detail.
