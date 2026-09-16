# Webhook platform service

Status: **built**. Lives under `src/platform/webhook` — see its
[README.md](../src/platform/webhook/README.md) for the public API, layout,
and rules/gotchas, and [Plan.md](../src/platform/webhook/Plan.md) for the
concrete implementation plan this build followed. This document stays as the
original design rationale (why a new service, why this scope).

## Why a new platform service (not an extension of `notification`)

The only "webhook" code in the repo today lives inside
`src/platform/notification/` and is **inbound-only**: `POST
/notifications/webhooks/:channel` receives SES/SNS delivery-status callbacks
(bounce/complaint/delivery), verified by
`notification/adapters/webhook-signature.util.ts` (HMAC shared-secret,
notification-specific), and folded into `ApplyDeliveryEventUseCase`. There is
no outbound webhook delivery anywhere in the repo (no subscriber registry, no
signed dispatch, no retry/backoff), and no other module receives inbound
webhooks.

`notification`'s inbound handling is tightly coupled to delivery-receipt
semantics (message matching, monotonic status, suppression) and **stays as
it is** — it is not being migrated onto the new service. `platform/webhook`
exists for capabilities notification's use case doesn't cover: generic
inbound receipt from *any* future external source (payment gateway, storage
provider, etc.), and all of outbound delivery.

## Scope: both directions

### Inbound (receiving)
1. **Generic receipt endpoint** — `POST /webhooks/:source`, unauthenticated
   at the transport level by design (same rationale as notification's
   webhook route): trust comes from per-source signature verification, not a
   bearer token an external system can't hold.
2. **Pluggable signature verification** — a per-source verifier registry,
   generalizing the HMAC pattern in `webhook-signature.util.ts` so a future
   source (e.g. a payment gateway with its own certificate-chain or
   HMAC-with-timestamp scheme) can plug in without touching the receiver.
3. **Idempotent dispatch to a registered handler** — dedupe via the existing
   `IdempotencyPort`, then route to whichever module registered interest in
   that `source` via a `WebhookInboundHandlerPort` (same shape as
   `notification`'s `NotificationHandler` port).

### Outbound (sending)
4. **Subscription registry** — CRUD for webhook endpoints: URL, signing
   secret, subscribed event types, tenant scope, active/paused status.
5. **Dispatch on domain events** — listens for outbox events matching a
   subscription's declared event types, builds a signed, replay-safe payload
   (HMAC + timestamp).
6. **Delivery execution with retry** — BullMQ worker posts to the subscriber
   URL with bounded exponential backoff, terminal `FAILED`/`DEAD_LETTER`
   state — same shape as `notification.worker.ts`.
7. **Reconciliation** — cron to requeue stuck deliveries and auto-pause
   chronically-failing endpoints (circuit breaker), mirroring
   `notification-reconciliation.consumer.ts`.
8. **Delivery observability** — list/inspect past deliveries, manual
   redelivery.

## Data model (new — `prisma/schema/platform/webhook.prisma`)

- `webhook_subscriptions` — `tenantId`, `url`, `secret`, `eventTypes[]`,
  `status`
- `webhook_deliveries` — `subscriptionId`, `eventType`, `payload`, `status`,
  `attemptCount`, `nextAttemptAt`, `lastResponseCode`/`lastError`

Inbound dedupe reuses the existing `idempotency` table — no new table needed
for that half.

## Wiring pattern

Both directions use the same composition-root bridge already established by
`configure-notifications.ts` / `configure-batch-operations.ts` /
`configure-imports.ts`: a new `src/bootstrap/configure-webhooks.ts` where
business modules register `{ eventName or source, ownerModule, handler }`
rows. Owner modules stay bodyless `@Module`s with zero registry knowledge —
same precedent as `PurchaseOrderNotificationAdapter`.

## Decisions made during the build

- **Outbound trigger model**: explicit opt-in list (`WEBHOOK_EVENT_TYPES` in
  `src/bootstrap/configure-webhooks.ts`), matching `NOTIFICATION_HANDLERS`'s
  precedent — not a fully-dynamic allowlist.
- **Subscription management surface**: admin/ops-only for v1 — in this repo
  that concretely means `@ApiBearerAuth()` only (there is no RBAC guard
  anywhere yet), not a new permission system.
- **Long-term relationship to `notification`'s inbound webhook**: stays
  permanently separate. Nothing in this build touches it.
- **Outbound retry authority**: BullMQ owns retry timing (`attempts` +
  exponential `backoff` on each delivery's own job, `jobId = deliveryId`) —
  not a DB-polled `nextAttemptAt`. `webhook-reconciliation.ts` exists only as
  a safety net for deliveries a crashed process left stuck or never enqueued.

See [Plan.md](../src/platform/webhook/Plan.md) for the file-by-file plan and
[README.md](../src/platform/webhook/README.md) for what's actually built.
