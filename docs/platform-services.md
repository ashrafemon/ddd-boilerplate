# ERP Boilerplate — Platform Services

Platform services are built on infrastructure clients and exposed to business code as **ports**.
`PlatformModule` imports every platform sub-module and re-exports them — deliberately **not**
`@Global`, so each business module lists `imports: [PlatformModule]` and the dependency stays
visible in module metadata.

## Service index

| Service | Module | Port(s) | Purpose |
|---------|--------|---------|---------|
| Outbox | `OutboxModule` | `OutboxWriterPort` | Transactional outbox — append events atomically with aggregate changes |
| Events | `EventsModule` | `InProcessEventBus` | In-process event bus (EventEmitter2 adapter, no routing table) |
| Messaging | `MessagingModule` | `MessageQueuePort` | Publish to RabbitMQ / Kafka / SQS by envelope broker field |
| Inbox | `InboxModule` | `InboxPort` | Consumer-side dedupe: receive → complete / fail |
| Context | `ContextModule` | `RequestContextPort` | CLS-backed per-request identity/trace; `set`/`get`/`require`/`run` |
| Locking | `LockingModule` | `DistributedLockPort` | Redis-based distributed lock with owner-token lease |
| Idempotency | `IdempotencyModule` | `IdempotencyPort` + `@Idempotent()` | Insert-as-claim, response replay, expiry purge |
| Numbering | `NumberingModule` | `NumberingPort` | Race-safe upsert-increment document numbering |
| Audit | `AuditModule` | `AuditPort` | Transactional audit rows enriched + redacted from CLS |
| Configuration | `ConfigurationModule` | `CompanyConfigPort` | Company configuration resolved from authenticated org |
| Cache | `CacheModule` | `CachePort` | Redis or Memcached adapter |
| Notification | `NotificationModule` | `NotificationDispatchPort` | SES email / SNS push SMS |
| Observability | `ObservabilityModule` | `LoggerPort` / `MetricsPort` / `ErrorTrackingPort` | Console logger, Prometheus metrics, Sentry |
| Storage | `StorageModule` | `FileStoragePort` | S3 upload/download/delete/metadata/presigned URL |
| Condition Engine | `ConditionEngineModule` | `ConditionEvaluator` | Generic AND/OR rule gate; field resolvers registered opt-in |
| Scheduler | `SchedulerModule` | `SchedulerPort` | DB-backed scheduled jobs, BullMQ execution, retry escalation |
| Recurring | `RecurringModule` | — | Recurring templates/executions, TIME+EVENT trigger model |
| Batch Operation | `BatchOperationModule` | — | Sync/async bulk transitions, chunk fan-out, claim-token fencing |
| Import | `ImportModule` | — | Upload → parse → mapping → validation → execution over S3 |
| Saga | `SagaModule` | `SagaInboundPort` | Company-configurable DO/UNDO orchestration over a frozen plan |
| Webhook | `WebhookModule` | — | Outbound delivery to subscriber URLs + inbound provider webhooks |
| Authentication | `AuthenticationModule` | `AuthenticationPort` | Resolves current authenticated identity from request context |
| Authorization | `AuthorizationModule` | `RbacPort`, `AbacPort` | Role-based + attribute-based access control |

## Platform invariants

1. **Tenancy**: every owned table gets `tenantId String?`; reads enforce
   `TenantScope.assertVisible` (foreign → 404, no leak); `TENANCY_MODE=multi` makes
   identity JWT-verified and fail-closed.
2. **Idempotent by construction**: claims use insert-as-claim or `FOR UPDATE SKIP LOCKED`,
   terminal writes are CAS/token-fenced (`version`, `status` where-guard, `claimToken`) so
   redeliveries re-run but never double-apply.
3. **Side effects via outbox only**: `OutboxWriterPort` inside the caller's `@Transactional()`
   — never publish from a use case.
4. **Physical column names**: hand-written `$queryRaw` must use the physical column names —
   platform tables are not uniform (`outbox_messages`, `inbox_messages`, `saga_steps` are
   snake_case, the rest camelCase).
5. **Bounded retries with visible parked states**: `FAILED`/`SUSPENDED`/`DEAD_LETTER`;
   every background state has a reconciler cron.
6. **File pattern**: one use case per file (`<verb>-<noun>.usecase.ts`), one request DTO per
   file (`http/requests/*.request.dto.ts`, Zod via `createZodDto`), ports are abstract classes
   used as DI tokens, providers use `useExisting`, module file contains bindings/exports only,
   `@Global()` is never used.
7. **Business opt-in registries**: bridged by the composition root
   `src/bootstrap/configure-*.ts` — generated adapters stay pure port data, no lifecycle,
   only platform ports.

## No-op adapters (IAM deferred)

IAM / Auth is deferred and NOT implemented. The following no-op adapters allow the DI graph
to boot without a real IAM service:

| Port | No-op adapter | Behavior |
|------|--------------|----------|
| `AuthenticationPort` | `NoopAuthenticationAdapter` | `getIdentity()` returns `null` |
| `RbacPort` | `NoopRbacAdapter` | `can()` returns `true` (fail-open) |
| `AbacPort` | `NoopAbacAdapter` | `evaluate()` returns `{ decision: 'ALLOW', scopeFilter: {} }` |

These are bound in `AuthenticationModule` and `AuthorizationModule` via `useExisting`.
Replace with real implementations when IAM is built; business use cases and guards are
unchanged.

## Service READMEs

Each platform service has its own `README.md` under `src/platform/<service>/README.md`
with sections: purpose, public API, layout, who-calls/how, data & config, tenancy behaviour,
rules.

See `docs/platform-services.md` for detailed per-service documentation.
