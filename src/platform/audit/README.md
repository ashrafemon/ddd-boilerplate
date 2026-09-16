# platform/audit — Audit trail

> Writes `audit_logs` rows describing *who did what to which entity*, inside
> the caller's DB transaction. Request/correlation/tenant/org/actor ids are
> filled from `RequestContextPort` when the caller omits them.

## What it does

`AuditPort.record(entry)` persists one row with `action`, `entityType`,
`entityId`, and a `changes` snapshot that is **redacted** (keys matching
password/secret/token/authorization/pin/otp → `[redacted]`) and length-capped
per field. `actorType` defaults to `user` when a userId is on the context,
else `system`. Writes go through `TransactionHost.tx` so they commit or roll
back atomically with the business change that triggered them.

## Public API

```ts
import { AuditPort, AuditEntry } from '@platform/audit/ports/audit.port';
await this.audit.record({ action, entityType, entityId, changes });
```

## Layout / bindings / tables

```
ports/audit.port.ts                     token + AuditEntry type
repositories/audit.repository.ts        PrismaAuditRepository, redaction
audit.module.ts                         port → repository (useExisting)
```
Writes `audit_logs` (prisma/schema/platform/platform.prisma). No config.
Imports `ContextModule` for identity fill-in.

## Who calls it / how called | Tenancy | Gotchas
State-change ops in `scheduler` (cancel, dispatch-now), `recurring`
(pause/resume/cancel), `batch-operation` (cancel), `import` (cancel/execute):
inject `AuditPort`.
- Reads `tenantId`/`organizationId` from `RequestContextPort` (`multi` mode ⇒
  JWT-verified).
- Not for logging/metrics — use observability. Redaction key list lives in
  the repository; extend it, don't redact in callers.
