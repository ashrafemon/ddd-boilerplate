# notification

The one shared way the platform reaches a human outside the app — Email,
SMS, Push — in response to a domain event (invoice approved, payment
overdue) or an explicit send. Adapted from the
`Notification_Service_Map-NestJS-v1` workbook for DB schema and business
rules only; the file architecture follows this repo's own platform-service
convention (`platform/batch-operation`, `platform/recurring`), not the
workbook's own module-wiring suggestions.

Distinct from its siblings by direction: they move records around inside the
system; this one crosses an external boundary to a third-party provider and,
uniquely, receives an asynchronous delivery receipt back later — sometimes
minutes, sometimes never.

## Shape

Flat platform-service layout — same convention as `platform/recurring`: root
classes + `events/`, `http/`, `ports/`, `usecases/`, `repositories/`,
`adapters/`, `__testing__/`. No business-module DDD layering — this module
has no aggregate of its own.

```
root
  notification.module.ts                DI wiring; registers the built-in
                                         channel providers in its OWN
                                         constructor (runs before any
                                         module's onApplicationBootstrap)
  notification-handler.registry.ts      Map<notificationType, handler>;
                                         validates declared channels against
                                         ChannelProviderRegistry at register()
  channel-provider.registry.ts          Map<channel, provider> + health
  notification.worker.ts                thin chunk loop: resolves the model
                                         ONCE per chunk, then
                                         RenderAndSendMessageUseCase per message
  notification-reconciliation.consumer.ts   @Cron: reset stuck RENDERING,
                                         re-enqueue PENDING, flag stale SENT
  notification-event.dispatcher.ts      EVENT trigger path (mirrors
                                         recurring/domain-event.dispatcher.ts)
  template-renderer.ts                  pure {{variable}} interpolation
  notification.types.ts · notification.errors.ts · notification.constants.ts
usecases/    business logic only, one class per capability, injected
             directly by the controller/worker — no per-usecase port+adapter
  send-notification.usecase.ts          Phases 1-3: dedup, resolve handler,
                                         the gate, fan-out, Sync/Async, dispatch
  render-and-send-message.usecase.ts    Phase 5: claim, render, send, record
  apply-delivery-event.usecase.ts       Phase 6: verify, match, monotonic apply
  finalise-notification-request.usecase.ts   Phase 7: terminal status + outbox
  get-notification-status.usecase.ts · list-notifications.usecase.ts
  list-notification-preferences.usecase.ts · upsert-notification-preference.usecase.ts
ports/   only genuine boundaries — see PORTS.md
repositories/                          DB-backed, same split as
                                        platform/recurring + platform/import
  prisma-notification.repository.ts     one class, five repo ports
  prisma-notification-outbox.writer.ts
  notification.mapper.ts
adapters/                              non-DB transports only
  bullmq-notification-queue.adapter.ts · bullmq-notification.worker.ts
  ses-email-channel.adapter.ts          EMAIL, over the existing SesService
  sns-channel.adapter.ts                SMS + PUSH, over the existing SnsService
  webhook-signature.util.ts
events/ · __testing__/
http/
  requests/    one DTO per file — notify.request.dto.ts ·
               notification-query.request.dto.ts ·
               upsert-notification-preference.request.dto.ts ·
               delivery-webhook.request.dto.ts
  POST /notifications · GET /notifications · GET /notifications/:id ·
  GET /notifications/_registry · POST /notifications/webhooks/:channel ·
  GET /notifications/preferences/:recipientRef · PUT /notifications/preferences
```

## Onboarding a notification-emitting domain module

Composition-root bridge — same precedent as `configure-batch-operations.ts` /
`configure-imports.ts` (§9.1). The owning domain module stays a bodyless
`@Module` with the handler as a plain provider; only
`src/bootstrap/configure-notifications.ts` knows both sides:

```ts
// inside the domain module — pure provider, no lifecycle hook, no registry import
@Module({
  imports: [PlatformModule],
  providers: [InvoiceNotificationAdapter /* + its own read-model deps */],
})
export class InvoiceModule {}

// src/bootstrap/configure-notifications.ts
export const NOTIFICATION_HANDLERS: readonly NotificationOptIn[] = [
  {
    notificationType: 'InvoiceOverdue',
    channels: ['EMAIL', 'SMS'],
    priority: 'NORMAL',
    eventName: 'InvoiceOverdue', // wires the EVENT-trigger path — omit for explicit-send-only
    ownerModule: InvoiceModule,
    notificationHandler: InvoiceNotificationAdapter,
  },
];
```

`configureNotifications(app)` runs in `src/bootstrap/index.ts` alongside
`configureBatchOperations`/`configureImports`, after the Nest app is created
but before it listens — so `NotificationModule`'s own constructor (which
registers the built-in channel providers) has already run, and
`NotificationHandlerRegistry.register()` can validate declared channels
against it. A duplicate notificationType throws at boot; see
`../../../src/business/procurement/purchase-order/infrastructure/adapters/platform/purchase-order-notification.adapter.ts`
for a real handler (PurchaseOrderApproved → EMAIL, vendor recipient).

The adapter implements `resolveRecipients()`/`resolveModel()` only — it never
renders a template, calls a provider, or writes a notification table. See
`ports/notification-handler.port.ts`. Every `channel` × `notificationType` ×
`locale` combination it fans out to also needs an active row in
`notification_templates` (seeded in `prisma/seed.ts` for dev) — a missing
template fails that one message with `NotificationTemplateNotFoundError`,
not the whole request.

## Not yet built (workbook "OPEN" items, carried over honestly)

- **Multi-provider failover** — one provider per channel for v1.
- **Quiet hours** — `quietHoursStart/End/timezone` are stored on
  `notification_preferences` but not enforced; a quiet-hours recipient is
  contacted immediately, not deferred.
- **In-app as a fourth channel** — the notification-centre bell is a
  frontend concern outside this pipeline.
- **Digest/batching** — every notification fans out individually.
- **PII retention/redaction** — no purge job for `notification_requests` /
  `notification_messages`; `notification_suppressions` is correctly never
  purged (a compliance record), the other tables simply have no retention
  job yet.
- **Real AWS delivery-status feeds** — `sns-channel.adapter.ts` accepts an
  already-normalised delivery event rather than parsing AWS's own
  CloudWatch-Logs-based SMS/push delivery reporting; `ses-email-channel.adapter.ts`
  does parse the real SES bounce/complaint/delivery notification shape.
- **Full SNS message signature verification** — `webhook-signature.util.ts`
  is an HMAC shared-secret check, not AWS SNS's certificate-chain scheme.
