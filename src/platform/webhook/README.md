# platform/webhook — Inbound receipt + outbound delivery

> The one shared way the platform crosses an HTTP boundary with an external
> system in either direction — receiving a webhook call from a provider, or
> delivering one of the platform's own events to a subscriber's URL.

Distinct from notification's own inbound delivery-receipt webhook
(SES/SNS bounce/complaint/delivery callbacks, tightly coupled to message
status semantics): that one stays exactly as-is. This module is generic —
zero domain knowledge, one HTTP receiver per inbound `source`, one
subscription-driven dispatcher for outbound `eventType`s.

## What it does

**Inbound**: `POST /webhooks/inbound/:source` resolves a registered
`{verify, handler}` pair for that source, verifies the signature (throws
`InvalidWebhookSignatureError` if it fails), reserves an
`IdempotencyPort` slot keyed `webhook.inbound.<source>` (dedupe — no new
table), then hands the raw payload to the source's `WebhookInboundHandlerPort`.

**Outbound**: any domain event whose class name is on the boot-time
`WEBHOOK_EVENT_TYPES` allowlist is matched against every `ACTIVE`
`WebhookSubscription` that declared that `eventType`; one `WebhookDelivery`
row is created per match (idempotent on `(subscriptionId, eventId)`), each
enqueued as its own BullMQ job (`jobId = deliveryId`). BullMQ owns retry
timing (`attempts`/exponential `backoff`, both configurable) — a delivery
attempt always throws on failure so BullMQ reschedules it; once BullMQ
itself exhausts every attempt, the delivery is marked `DEAD_LETTER` and a
`WebhookDeliveryExhaustedEvent` is announced. A subscription that racks up
`circuitBreakerThreshold` consecutive failures is auto-paused
(`WebhookSubscriptionAutoPausedEvent`).

## Public API

```ts
// Outbound — business/ops HTTP surface (admin/ops-only in v1, @ApiBearerAuth())
POST   /webhooks/subscriptions
GET    /webhooks/subscriptions
GET    /webhooks/subscriptions/:id
PATCH  /webhooks/subscriptions/:id        // also covers pause/resume/disable
DELETE /webhooks/subscriptions/:id
GET    /webhooks/subscriptions/:id/deliveries
POST   /webhooks/deliveries/:id/redeliver  // manual retry of a DEAD_LETTER delivery
GET    /webhooks/_registry                 // registered eventTypes + inbound sources

// Inbound — unauthenticated at the transport level (see Rules & gotchas)
POST   /webhooks/inbound/:source
```

Programmatic: inject `WebhookEventTypeRegistry` / `WebhookInboundSourceRegistry`
to introspect what's registered; both are populated exclusively by
`src/bootstrap/configure-webhooks.ts`, never at runtime.

## Layout

```
webhook.module.ts                     DI wiring only
webhook.types.ts · webhook.errors.ts · webhook.constants.ts
webhook-event-type.registry.ts        in-memory allowlist (outbound gate)
webhook-inbound-source.registry.ts    Map<source, {verify, handler}>
webhook-dispatch.dispatcher.ts        EVENT trigger path (mirrors
                                       notification/notification-event.dispatcher.ts)
webhook-reconciliation.ts             @Cron: reset stuck DELIVERING + re-enqueue
                                       stale never-enqueued PENDING
usecases/    one class per file
  create-webhook-subscription.usecase.ts · update-webhook-subscription.usecase.ts
  delete-webhook-subscription.usecase.ts · get-webhook-subscription.usecase.ts
  list-webhook-subscriptions.usecase.ts
  dispatch-webhook-event.usecase.ts     fan-out: eventType -> delivery rows -> enqueue
  deliver-webhook.usecase.ts            one attempt: sign, POST, success/failure/circuit-breaker
  mark-webhook-delivery-exhausted.usecase.ts   BullMQ gave up -> DEAD_LETTER + event
  list-webhook-deliveries.usecase.ts · redeliver-webhook.usecase.ts
  receive-inbound-webhook.usecase.ts    verify, dedupe via IdempotencyPort, handle
ports/       only genuine boundaries
repositories/                         DB-backed
  prisma-webhook-subscription.repository.ts · prisma-webhook-delivery.repository.ts
  webhook.mapper.ts
adapters/                             non-DB transports only
  bullmq-webhook-queue.adapter.ts · bullmq-webhook.worker.ts
  http-webhook-transport.adapter.ts · webhook-signature.util.ts
events/ · __testing__/
http/
  requests/    one DTO per file
```

## Who calls it / how called

| Consumer | How |
| --- | --- |
| none yet | `WEBHOOK_EVENT_TYPES` and `WEBHOOK_INBOUND_SOURCES` in `src/bootstrap/configure-webhooks.ts` both start empty — ships ahead of consumers, same as `CachePort`/`EmailPort` (PLATFORM-SERVICE-GUIDE §6) |

## Onboarding an eventType or an inbound source

Composition-root bridge — same precedent as `configure-notifications.ts`.
The owning domain module stays a bodyless `@Module` for inbound handlers
(pure `WebhookInboundHandlerPort` provider, no lifecycle, no registry
import); only `src/bootstrap/configure-webhooks.ts` knows both sides:

```ts
export const WEBHOOK_EVENT_TYPES: readonly string[] = [
  'PurchaseOrderApproved', // any outbox event class name a subscription may declare
];

export const WEBHOOK_INBOUND_SOURCES: readonly WebhookInboundSourceOptIn[] = [
  {
    source: 'stripe',
    verify: (rawBody, signature) => verifyStripeSignature(rawBody, signature),
    ownerModule: PaymentModule,
    inboundHandler: StripeWebhookAdapter,
  },
];
```

A subscription may only declare `eventTypes` present in
`WEBHOOK_EVENT_TYPES` (`WebhookEventTypeNotAllowedError` otherwise) — the
dispatcher also checks this allowlist before touching the DB, so an event
nobody could ever subscribe to never triggers a query.

## Data & config

- `webhook_subscriptions` — `tenantId?`, `url`, `secret`, `eventTypes[]`,
  `status`, `consecutiveFailures`, `lastSuccessAt`/`lastFailureAt`.
- `webhook_deliveries` — `subscriptionId`, `eventId`, `eventType`, `payload`,
  `status`, `attemptCount`, `nextAttemptAt` (informational — BullMQ owns
  actual retry timing), `lastResponseCode`/`lastError`. `UNIQUE
  (subscriptionId, eventId)`.
- Inbound dedupe reuses the platform `idempotency_keys` table — no table of
  its own.
- `src/config/webhook.config.ts` / `ConfigService.getWebhook()`:
  `WEBHOOK_DELIVERY_ATTEMPTS` (6), `WEBHOOK_DELIVERY_TIMEOUT_MS` (10s),
  `WEBHOOK_BACKOFF_BASE_MS` (30s), `WEBHOOK_CIRCUIT_BREAKER_THRESHOLD` (10),
  `WEBHOOK_RECONCILIATION_WINDOW_MS` (10min), `WEBHOOK_WORKER_CONCURRENCY` (5).

## Tenancy behaviour

Subscriptions and deliveries carry `tenantId?` like every other platform
table; reads go through `TenantScope.assertVisible` (foreign → 404).
`findActiveByEventType` intentionally is NOT tenant-scoped at the DB level —
outbound dispatch fans out per-subscription, and each delivery row inherits
its subscription's own `tenantId`.

## Rules & gotchas

- The inbound route is unauthenticated at the transport level by design —
  trust comes from the per-source signature check inside
  `ReceiveInboundWebhookUseCase`, not a bearer token an external system
  cannot hold. Never add `@ApiBearerAuth()` to it.
- BullMQ, not the database, owns outbound retry timing. `nextAttemptAt` on
  `webhook_deliveries` is informational only — do not build new logic that
  polls on it expecting authoritative scheduling; `webhook-reconciliation.ts`
  only exists as a safety net for crashed/never-enqueued rows.
- `jobId = deliveryId` at enqueue time is what makes `RedeliverWebhookUseCase`
  and reconciliation's re-enqueue safe to call redundantly — both rely on
  `removeOnComplete`/`removeOnFail` freeing the id once a job reaches a
  terminal BullMQ state.
- A subscription auto-pauses itself at `circuitBreakerThreshold` consecutive
  failures — nothing auto-resumes it; an operator must `PATCH` it back to
  `ACTIVE`.
