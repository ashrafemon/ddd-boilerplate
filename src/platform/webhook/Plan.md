# Build `src/platform/webhook` — inbound + outbound webhook platform service

## Context

`docs/webhook.md` proposed this service; the user has now confirmed scope:
**both directions** (inbound receipt + outbound subscription/dispatch/retry),
**explicit opt-in event-type list** (mirrors `NOTIFICATION_HANDLERS`, not a
fully-dynamic allowlist), **admin/ops-only** management surface for v1 (in
this repo that concretely means `@ApiBearerAuth()` only — there is no RBAC
guard anywhere yet, confirmed by grep; "admin-only" ≠ a new permission
system, it's just "not self-service, no extra tenant-facing quota/URL
hardening in v1").

Today `notification`'s inbound webhook (SES/SNS delivery receipts) is the
only existing webhook code and it **stays exactly as-is** — nothing here
touches it. This service is new territory for outbound delivery, and a
generic (not notification-specific) inbound receiver for future sources.

Research already done (three parallel Explore passes + direct reads of
`docs/PLATFORM-SERVICE-GUIDE.md`, `notification/README.md`,
`idempotency`/`locking` in full, `notification`'s worker/registry/dispatcher
files, `outbox`/composition-root/config/ESLint conventions, `tsconfig.json`
path aliases, `platform.module.ts`, `config.module.ts`,
`notification.prisma`, `notification.controller.ts`) — every pattern below
is copied from a real file in this repo, not invented.

## Directory layout (`src/platform/webhook/`)

Flat platform-service shape, same convention as `notification`/`recurring`.

```
webhook.module.ts
webhook.types.ts        WebhookSubscriptionStatus, WebhookDeliveryStatus,
                         WebhookSubscriptionRecord, WebhookDeliveryRecord,
                         NewWebhookSubscription, WebhookSignatureVerifier fn type,
                         InboundWebhookContext
webhook.errors.ts        one DomainException subclass per failure mode
                         (WebhookSubscriptionNotFoundError,
                         WebhookEventTypeNotAllowedError,
                         WebhookDeliveryNotFoundError,
                         InvalidWebhookSignatureError,
                         DuplicateWebhookInboundSourceRegistrationError,
                         UnregisteredWebhookInboundSourceError)
webhook-event-type.registry.ts     in-memory allowlist (extends
                         KeyedRegistryBase from
                         @shared-kernel/utils/keyed-registry.base — same
                         base ChannelProviderRegistry/BatchOperationHandlerRegistry
                         use). register(eventType) / has(eventType) / health().
webhook-inbound-source.registry.ts  Map<source, {verify, handler}>, same
                         KeyedRegistryBase; validates nothing external (no
                         cross-registry check needed, unlike notification's
                         channel validation).
webhook-dispatch.dispatcher.ts      OnModuleInit + eventEmitter.onAny(...),
                         copied structurally from
                         notification/notification-event.dispatcher.ts:
                         match eventName against
                         WebhookEventTypeRegistry.has(), derive eventId via
                         the same DispatcherEventReader-style structural
                         read used in recurring/domain-event.dispatcher.ts,
                         call DispatchWebhookEventUseCase.execute(eventType,
                         eventId, snapshot). Per-event try/catch so one
                         failure doesn't block others.

ports/
  webhook-subscription-repository.port.ts   abstract class: create, findById,
    findActiveByEventType(eventType, tenantId?), list(query), update,
    recordDeliveryOutcome(id, {success: boolean}) [updates
    consecutiveFailures/lastSuccessAt/lastFailureAt], delete
  webhook-delivery-repository.port.ts        abstract class: createMany
    (idempotent on (subscriptionId,eventId) — ON CONFLICT DO NOTHING style,
    see Data model), claimDue(limit) [FOR UPDATE SKIP LOCKED, same shape as
    idempotency's takeover query], markDelivered, markFailedForRetry(id,
    nextAttemptAt, responseCode?, error?), markDeadLettered, resetStuck
    (claimedAt older than window -> PENDING), findById, list(query)
  webhook-queue-publisher.port.ts   abstract class: enqueueDelivery(deliveryId)
  webhook-transport.port.ts         abstract class: post(url, body, headers,
    timeoutMs): Promise<{statusCode:number}> — adapter owns HTTP client +
    timeout, throws on network/timeout error
  webhook-inbound-handler.port.ts   plain interface (NOT abstract class —
    same as NotificationHandler: business-implemented, not DI-resolved by
    platform): handle(payload: unknown, context: InboundWebhookContext): Promise<void>

repositories/
  prisma-webhook-subscription.repository.ts   implements
    WebhookSubscriptionRepositoryPort, constructor(txHost: TransactionHost
    <TransactionalAdapterPrisma>) — same as every other Prisma repo in this repo
  prisma-webhook-delivery.repository.ts        implements
    WebhookDeliveryRepositoryPort. claimDue() uses a raw
    `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING *`
    query, same shape as idempotency's takeover UPDATE. Settlement
    (markDelivered/markFailedForRetry/markDeadLettered) uses conditional
    updateMany gated on status='DELIVERING', same CAS discipline as
    idempotency's settle calls — never a bare update().
  webhook.mapper.ts    Prisma row <-> domain record, mirrors
                        notification/repositories/notification.mapper.ts

adapters/
  bullmq-webhook-queue.adapter.ts   implements WebhookQueuePublisherPort.
    queue.add(WEBHOOK_DELIVERY_JOB_NAME, {deliveryId}, {jobId: deliveryId,
    attempts: config.deliveryAttempts, backoff: {type:'exponential',
    delay: config.backoffBaseMs}, removeOnComplete: true}) — jobId =
    deliveryId gives BullMQ-level dedupe, same trick as notification's
    `requestId:chunk:i:firstMessageId`.
  bullmq-webhook.worker.ts   @Processor(WEBHOOK_QUEUE_NAME, {concurrency:
    WEBHOOK_WORKER_CONCURRENCY}) extends WorkerHost, process(job) calls
    DeliverWebhookUseCase.execute(job.data.deliveryId),
    @OnWorkerEvent('failed') logs only once attemptsMade >= max (identical
    shape to BullMqNotificationWorker) — no dead-letter handling in the
    worker itself, that's the use case's job (bounded retries -> DEAD_LETTER
    state, not a BullMQ concept).
  http-webhook-transport.adapter.ts   implements WebhookTransportPort using
    Node's built-in fetch with an AbortController timeout (repo has no
    existing shared HTTP client for platform — confirm during build; if one
    exists under @infrastructure, use that instead)
  webhook-signature.util.ts   small self-contained HMAC-SHA256 sign +
    timingSafeEqual verify pair, deliberately duplicated (not imported)
    from notification's own webhook-signature.util.ts — keeps webhook and
    notification modules independent per the "platform services stay flat,
    no cross-module coupling beyond shared ports" convention; both are
    ~15-line pure functions so duplication cost is negligible

usecases/    one class per file
  create-webhook-subscription.usecase.ts   validates every requested
    eventType against WebhookEventTypeRegistry.has() (throws
    WebhookEventTypeNotAllowedError otherwise) — same cross-check notify
    does against ChannelProviderRegistry
  update-webhook-subscription.usecase.ts   url/secret/eventTypes/status
    edits (status covers pause/resume/disable — no separate usecases for
    those, they're just a status value)
  delete-webhook-subscription.usecase.ts
  get-webhook-subscription.usecase.ts
  list-webhook-subscriptions.usecase.ts
  dispatch-webhook-event.usecase.ts   entry point from the dispatcher:
    findActiveByEventType, build one WebhookDelivery row per matching
    subscription (payload = the event snapshot, already domain-free JSON —
    zero @business knowledge needed), createMany is idempotent on
    (subscriptionId, eventId) so a re-delivered outbox event can't
    double-create deliveries, then enqueueDelivery per created row
  deliver-webhook.usecase.ts   entry point from the worker: load delivery +
    subscription, sign payload via webhook-signature.util, POST via
    WebhookTransportPort with configured timeout; 2xx -> markDelivered +
    recordDeliveryOutcome(success); non-2xx/error -> markFailedForRetry
    (attemptCount < max) or markDeadLettered (attempts exhausted) +
    recordDeliveryOutcome(failure); if subscription.consecutiveFailures
    crosses config.circuitBreakerThreshold, flip subscription to PAUSED and
    append a WebhookSubscriptionAutoPausedEvent via OutboxWriterPort
  list-webhook-deliveries.usecase.ts
  redeliver-webhook.usecase.ts   admin manual retry: reset a
    FAILED/DEAD_LETTER delivery to PENDING (attemptCount NOT reset — keeps
    the real attempt history), re-enqueue
  receive-inbound-webhook.usecase.ts   generic inbound entry point (worker
    for `notification`'s own webhook is NOT this — unrelated, untouched):
    resolve {verify, handler} from WebhookInboundSourceRegistry by source
    (404-equivalent WebhookInboundSourceNotFoundError if unregistered),
    verify(rawBody, signature) (throws InvalidWebhookSignatureError),
    IdempotencyPort.reserve({scope: `webhook.inbound.${source}`, key:
    <derived from a caller-supplied idempotency header, falling back to a
    hash of the raw body>}) — REPLAY short-circuits, ACQUIRED proceeds to
    handler.handle(payload, context) then markCompleted/markFailed. Reuses
    IdempotencyPort exactly as PLATFORM-SERVICE-GUIDE §"Leases & dedupe"
    prescribes — no new table for inbound dedupe.

events/
  webhook-delivery-exhausted.event.ts        extends OutboxEventBase
  webhook-subscription-auto-paused.event.ts  extends OutboxEventBase
  webhook.registry.ts   outboxEventRegistry.register(...) for both, same
                         shape as recurring/events/recurring.registry.ts,
                         activated by a side-effect import from
                         deliver-webhook.usecase.ts (the only writer)

http/
  webhook.controller.ts
    GET  /webhooks/_registry                    health: event types + inbound sources
    POST /webhooks/subscriptions                @ApiBearerAuth()
    GET  /webhooks/subscriptions                @ApiBearerAuth()
    GET  /webhooks/subscriptions/:id             @ApiBearerAuth()
    PATCH /webhooks/subscriptions/:id            @ApiBearerAuth()
    DELETE /webhooks/subscriptions/:id           @ApiBearerAuth()
    GET  /webhooks/subscriptions/:id/deliveries  @ApiBearerAuth()
    POST /webhooks/deliveries/:id/redeliver      @ApiBearerAuth()
    POST /webhooks/inbound/:source               @HttpCode(200), NO
      @ApiBearerAuth() — unauthenticated at the transport level, same
      documented rationale as notification's webhook route (trust = the
      per-source signature check inside the use case, not a bearer token an
      external system can't hold)
  requests/   one DTO per file, zod (createZodDto), mirrors notification's
    create-webhook-subscription.request.dto.ts
    update-webhook-subscription.request.dto.ts
    webhook-subscription-query.request.dto.ts
    webhook-delivery-query.request.dto.ts
    inbound-webhook.request.dto.ts   permissive z.record(z.string(),
      z.unknown()), same as DeliveryWebhookDto — source-specific parsing
      happens inside the resolved handler, not at the DTO layer

webhook-reconciliation.ts   @Cron(CronExpression.EVERY_5_MINUTES, {name:
  'webhook-reconciliation'}), same running-boolean re-entrancy guard as
  NotificationReconciliationConsumer: resetStuck() requeues deliveries
  claimed (DELIVERING) past config.deliveringStuckWindowMs back to PENDING;
  logs (never auto-transitions to DELIVERED) any FAILED delivery sitting
  past its nextAttemptAt with attempts exhausted that somehow never reached
  DEAD_LETTER — defensive only, matches notification's "nothing here may
  fabricate a success" rule

__testing__/
  in-memory-webhook-subscription.repository.ts
  in-memory-webhook-delivery.repository.ts

README.md   the mandatory 7-section template (What it does / Public API /
  Layout / Who calls it / how called / Data & config / Tenancy behaviour /
  Rules & gotchas) — "Who calls it" table starts with "none yet" for
  WEBHOOK_INBOUND_SOURCES, same honest pattern PLATFORM-SERVICE-GUIDE §6
  sanctions for CachePort/EmailPort
```

## Data model — `prisma/schema/platform/webhook.prisma` (new file + migration)

Two tables, modeled directly on `notification.prisma`'s shape (tenant-nullable,
`@@map` snake_case, enums with `@@map`):

```prisma
model WebhookSubscription {
  id                  String                     @id @default(uuid()) @db.Uuid
  tenantId            String?
  url                 String
  secret              String
  eventTypes          String[]
  status              WebhookSubscriptionStatus  @default(ACTIVE)
  description         String?
  consecutiveFailures Int                        @default(0)
  lastSuccessAt       DateTime?
  lastFailureAt       DateTime?
  createdAt           DateTime                   @default(now())
  updatedAt           DateTime                   @updatedAt

  deliveries WebhookDelivery[]

  @@index([tenantId, status])
  @@map("webhook_subscriptions")
}
enum WebhookSubscriptionStatus { ACTIVE PAUSED DISABLED @@map("webhook_subscription_status") }

model WebhookDelivery {
  id               String                @id @default(uuid()) @db.Uuid
  tenantId         String?
  subscriptionId   String                @db.Uuid
  eventId          String
  eventType        String
  payload          Json
  status           WebhookDeliveryStatus @default(PENDING)
  attemptCount     Int                   @default(0)
  nextAttemptAt    DateTime              @default(now())
  claimedAt        DateTime?
  lastResponseCode Int?
  lastError        String?
  deliveredAt      DateTime?
  createdAt        DateTime              @default(now())
  updatedAt        DateTime              @updatedAt

  subscription WebhookSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@unique([subscriptionId, eventId])
  @@index([status, nextAttemptAt])
  @@index([tenantId, status, createdAt(sort: Desc)])
  @@map("webhook_deliveries")
}
enum WebhookDeliveryStatus { PENDING DELIVERING DELIVERED FAILED DEAD_LETTER @@map("webhook_delivery_status") }
```

Hand-written migration SQL in
`prisma/migrations/<yyyymmddhhmmss>_webhook_subscriptions_and_deliveries/migration.sql`,
same style as `20260915025800_idempotency_ledger`. Inbound dedupe needs **no
new table** — it reuses the existing `idempotency_keys` table via
`IdempotencyPort` (scope `webhook.inbound.<source>`).

## Config — `src/config/webhook.config.ts` (new) + `ConfigService.getWebhook()`

```ts
export type IWebhookConfig = {
  deliveryAttempts: number;         // WEBHOOK_DELIVERY_ATTEMPTS, default 6
  deliveryTimeoutMs: number;        // WEBHOOK_DELIVERY_TIMEOUT_MS, default 10_000
  backoffBaseMs: number;            // WEBHOOK_BACKOFF_BASE_MS, default 30_000
  circuitBreakerThreshold: number;  // WEBHOOK_CIRCUIT_BREAKER_THRESHOLD, default 10
  deliveringStuckWindowMs: number;  // WEBHOOK_DELIVERING_STUCK_WINDOW_MS, default 600_000
  workerConcurrency: number;        // WEBHOOK_WORKER_CONCURRENCY, default 5
};
export default registerAs('webhook', (): IWebhookConfig => ({ ...numericEnv(...) }));
```
Same shape as `idempotency.config.ts`. Wire into `src/config/config.module.ts`
(`NestConfigModule.forFeature(webhookConfig)`) and add a `getWebhook()`
getter to `src/config/config.service.ts` matching `getIdempotency()`'s
pattern exactly. Add the six env vars to `.env.example`.

## Composition root — `src/bootstrap/configure-webhooks.ts` (new)

Two independent opt-in arrays, following `configure-batch-operations.ts`'s
exact shape (the cleanest precedent):

```ts
export const WEBHOOK_EVENT_TYPES: readonly string[] = [
  // none yet — a business module opts an event in here when it needs
  // outbound webhook fan-out; ships ahead of consumers like other platform
  // ports (PLATFORM-SERVICE-GUIDE §6)
];

export interface WebhookInboundSourceOptIn {
  source: string;
  verify: WebhookSignatureVerifier;
  ownerModule: Type<unknown>;
  inboundHandler: Type<WebhookInboundHandlerPort>;
}
export const WEBHOOK_INBOUND_SOURCES: readonly WebhookInboundSourceOptIn[] = [];

export function configureWebhooks(app: INestApplicationContext): void {
  const eventTypes = app.get(WebhookEventTypeRegistry);
  for (const eventType of WEBHOOK_EVENT_TYPES) eventTypes.register(eventType);

  const inbound = app.get(WebhookInboundSourceRegistry);
  for (const { source, verify, ownerModule, inboundHandler } of WEBHOOK_INBOUND_SOURCES) {
    inbound.register(source, { verify, handler: app.select(ownerModule).get(inboundHandler, { strict: true }) });
  }
}
```

Called from `src/bootstrap/index.ts` alongside
`configureBatchOperations(app)` / `configureImports(app)` /
`configureNotifications(app)`, in the same block, same ordering rule (must
run before `configureServer`/`listen()`).

Both arrays start **empty** — no business module needs webhooks yet. This
ships the full platform capability with zero fake/demo consumers wired in,
same as the guide sanctions.

## Wiring changes to existing files

- `src/platform/platform.module.ts` — add `WebhookModule` to `imports` and `exports`.
- `src/config/config.module.ts` — add `webhookConfig` import + `NestConfigModule.forFeature(webhookConfig)`.
- `src/config/config.service.ts` — add `getWebhook()`.
- `.env.example` — six `WEBHOOK_*` vars.
- `src/bootstrap/index.ts` — add `configureWebhooks(app)` next to the other three composition-root calls.
- `src/platform/README.md` — new catalog row.
- `docs/webhook.md` — flip status from "proposed" to reflect what's built; keep the open-decisions section only for anything still genuinely open (none, after this build).
- `docs/DI-WIRING.md` — regenerate via `npm run docs:di` (last build step, not hand-edited).

## Build order (follow `PLATFORM-SERVICE-GUIDE.md` §2 exactly)

1. Ports (`ports/`) — contract first.
2. `prisma/schema/platform/webhook.prisma` + hand-written migration → `npx prisma generate`.
3. `src/config/webhook.config.ts` + `ConfigService.getWebhook()` + `.env.example`.
4. Repositories (`repositories/`) + colocated specs (fakes only, no DB).
5. Use cases (one per file) + `webhook.module.ts` (bindings only).
6. HTTP: controller + one-DTO-per-file requests, `ParseUUIDPipe` on uuid params.
7. Background: BullMQ adapter/worker + `webhook-reconciliation.ts`; workers restore tenancy via `RequestContextPort.run(...)` before touching anything.
8. Events: `events/*.event.ts` + `webhook.registry.ts`.
9. `src/platform/platform.module.ts` imports/exports.
10. `src/platform/README.md` catalog row; `src/platform/webhook/README.md` (7-section template).
11. `src/bootstrap/configure-webhooks.ts` + wire into `src/bootstrap/index.ts`.
12. `npm run docs:di`.

## Verification

- `npx prisma generate && npx tsc --noEmit -p tsconfig.json && npm run lint:check && npm test && npm run build` — all green (the PLATFORM-SERVICE-GUIDE §4 gate list).
- DI-graph smoke test from the guide (`NestFactory.create(AppModule, {preview:true})` + `init()` + `close()`) to prove `WebhookModule` wires cleanly with zero business imports.
- Colocated unit specs for: subscription CRUD use cases (validation of `eventTypes` against the registry), `dispatch-webhook-event` (idempotent delivery creation on duplicate eventId), `deliver-webhook` (success path, retry-with-backoff path, dead-letter path, circuit-breaker auto-pause path), `receive-inbound-webhook` (unregistered source, bad signature, replay via idempotency) — plain fakes / `__testing__/in-memory-*` repos, no DB, no BullMQ, per the guide's test pattern.
- ESLint boundary check: confirm zero `@business/**` imports anywhere under `src/platform/webhook/` (the existing `eslint.config.mjs` regex enforces this automatically).
- No manual DB/HTTP smoke test planned in this pass since `WEBHOOK_EVENT_TYPES`/`WEBHOOK_INBOUND_SOURCES` start empty — there's no real consumer to exercise end-to-end yet; the gates above are the full verification surface for this build.
