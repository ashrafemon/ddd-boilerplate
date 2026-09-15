# platform/notification — Outbound messaging (email + push/sms)

> Sends user-facing notifications through SES (email) and SNS (push/sms)
> with a single dispatch facade, and degrades to no-op logging when a channel
> is not configured.

## What it does

`NotificationDispatchPort.send(message)` routes by `channel`: `email` (or
unset) → `EmailPort` (SES, body as text/html); `push`/`sms` → `NotificationPort`
(SNS topic publish). Correlation/tenant/org ids are attached as tags/message
attributes. If SES/SNS clients or `from`/topic are missing (local dev), the
call logs a `*-skipped-disabled` debug line and returns — never throws.

## Public API

```ts
import { NotificationDispatchPort } from '@platform/notification/ports/notification.port';
await this.notify.send({ to, subject, body, channel: 'email', tenantId, correlationId });
```

## Layout / bindings / config
`ports/` (NotificationDispatchPort, EmailPort, NotificationPort),
`adapters/ses-email.adapter.ts` + `sns-notification.adapter.ts`,
`notification-dispatch.service.ts`, `notification.module.ts` (adapters
`useExisting`; imports infra `@infrastructure/notification` +
`ObservabilityModule` for `LoggerPort`). Raw clients self-configure from
`notification.ses` / `notification.sns` (`notification.config.ts`).

## Who calls it / how called
Intended for business command use cases (order confirmations, etc.); today
**no external consumer** injects `NotificationDispatchPort` (only the dispatch
service uses the two inner ports) — it is the ready seam for the first
notification-emitting use case. Kept exported on `PlatformModule`.

## Rules & gotchas
- Inject `NotificationDispatchPort` (the routing facade), not the raw
  Email/NotificationPorts.
- SNS subject is truncated to 100 chars by design; SES needs a verified
  `from`. Add a channel by extending the dispatch routing map.
