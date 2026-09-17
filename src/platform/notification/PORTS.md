# Notification — Ports

Hexagonal map of every port under `src/platform/notification`, who implements it, and who calls it. Wiring lives in `notification.module.ts`.

Same convention as `platform/recurring`/`platform/batch-operation`: `ports/`
holds only genuine outbound/plugin boundaries, each with exactly one
production implementation. The controller and the worker inject usecases
directly — no inbound port + adapter wrapper per usecase.

Notification differs from its siblings by having **two** cross-hexagon
boundaries instead of one: an inward `NotificationHandlerPort` (a real
external boundary needs a transport port too) and an outward
`ChannelProviderPort`.

## Outbound / plugin ports (driven)

| Port                                   | Port file                                          | Implementation                                                   | Implementation path                                                    | Notes                                                                     |
| --------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `NotificationRequestRepositoryPort`     | `ports/notification-request-repository.port.ts`     | `PrismaNotificationRepository`                                    | `repositories/prisma-notification.repository.ts`                        | Header create (1.4) + `attachMessages` (3.1) — two calls, one domain handler in between |
| `NotificationMessageRepositoryPort`     | `ports/notification-message-repository.port.ts`     | `PrismaNotificationRepository`                                    | same file as above                                                       | `claim()` is the send idempotency grain; `applyDeliveryStatus()` enforces the monotonic order in SQL |
| `NotificationTemplateRepositoryPort`    | `ports/notification-template-repository.port.ts`    | `PrismaNotificationRepository`                                    | same file as above                                                       | Tenant override preferred over the platform-default (`tenantId = null`) row |
| `NotificationPreferenceRepositoryPort`  | `ports/notification-preference-repository.port.ts`  | `PrismaNotificationRepository`                                    | same file as above                                                       | The consent half of the gate                                                |
| `NotificationSuppressionRepositoryPort` | `ports/notification-suppression-repository.port.ts` | `PrismaNotificationRepository`                                    | same file as above                                                       | The compliance half of the gate                                             |
| `NotificationQueuePublisherPort`        | `ports/notification-queue-publisher.port.ts`        | `BullMqNotificationQueueAdapter`                                  | `adapters/bullmq-notification-queue.adapter.ts`                         | Async chunk enqueue; Sync bypasses this and calls the worker in-process     |
| `NotificationOutboxWriterPort`          | `ports/notification-outbox-writer.port.ts`          | `PrismaNotificationOutboxWriter`                                  | `repositories/prisma-notification-outbox.writer.ts`                     | Writes `NotificationRequestCompletedEvent` via `OutboxWriterPort`           |
| `NotificationHandler` (interface)       | `ports/notification-handler.port.ts`                | Per-notificationType adapter (e.g. a future `InvoiceNotificationProvider`) | Domain module, e.g. `src/business/.../invoice-notification.provider.ts` | Registered by the owning module's `onApplicationBootstrap` on `NotificationHandlerRegistry` |
| `ChannelProvider` (interface)           | `ports/channel-provider.port.ts`                    | `SesEmailChannelAdapter` (EMAIL), `SnsSmsChannelAdapter` (SMS), `SnsPushChannelAdapter` (PUSH) | `adapters/ses-email-channel.adapter.ts`, `adapters/sns-channel.adapter.ts` | Registered by `NotificationModule`'s own constructor — before any module's `onApplicationBootstrap` |

### DI wiring (outbound)

```ts
{ provide: NotificationRequestRepositoryPort, useExisting: PrismaNotificationRepository }
{ provide: NotificationMessageRepositoryPort, useExisting: PrismaNotificationRepository }
{ provide: NotificationTemplateRepositoryPort, useExisting: PrismaNotificationRepository }
{ provide: NotificationPreferenceRepositoryPort, useExisting: PrismaNotificationRepository }
{ provide: NotificationSuppressionRepositoryPort, useExisting: PrismaNotificationRepository }
{ provide: NotificationQueuePublisherPort, useExisting: BullMqNotificationQueueAdapter }
{ provide: NotificationOutboxWriterPort, useExisting: PrismaNotificationOutboxWriter }
// NotificationHandler — not provided here; domain modules register adapters at boot
// ChannelProvider — registered in NotificationModule's own constructor (see notification.module.ts)
```

### Test doubles

| Port(s)                        | Test double                     | Path                                                |
| ------------------------------- | -------------------------------- | ----------------------------------------------------- |
| All five repository ports       | `InMemoryNotificationRepository` | `__testing__/in-memory-notification.repository.ts`  |

---

## Related non-port files (call chain)

| Role                                 | File                                | Path                                          |
| ------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| HTTP driving adapter                  | `NotificationController`           | `http/notification.controller.ts`               |
| Inbound EVENT-trigger driving adapter | `NotificationEventDispatcher`      | `notification-event.dispatcher.ts`              |
| Thin chunk loop                       | `NotificationWorker`               | `notification.worker.ts`                        |
| BullMQ consumer                       | `BullMqNotificationWorker`         | `adapters/bullmq-notification.worker.ts`        |
| Stuck-message / stale-Sent sweep      | `NotificationReconciliationConsumer` | `notification-reconciliation.consumer.ts`     |
| Handler registry                      | `NotificationHandlerRegistry`      | `notification-handler.registry.ts`              |
| Channel registry                      | `ChannelProviderRegistry`          | `channel-provider.registry.ts`                  |
| Pure template renderer                | `TemplateRenderer`                 | `template-renderer.ts`                          |
| Prisma mapper                         | `NotificationMapper`               | `repositories/notification.mapper.ts`           |
| Completed event                       | `NotificationRequestCompletedEvent`| `events/notification-request-completed.event.ts` |
| Queue name constants                  | `NOTIFICATION_QUEUE_NAME`          | `notification.constants.ts`                     |

---

## Flow (who talks to which port)

```
Controller / NotificationEventDispatcher (inject usecases directly, no inbound port)
  └─ SendNotificationUseCase
        ├─ NotificationRequestRepositoryPort   (dedup, create, attachMessages, finalise*)
        ├─ NotificationHandlerRegistry → NotificationHandler   (resolveRecipients/resolveModel)
        ├─ NotificationPreferenceRepositoryPort  ┐ the gate
        ├─ NotificationSuppressionRepositoryPort ┘
        └─ NotificationWorker (Sync)  OR  NotificationQueuePublisherPort (Async)

BullMqNotificationWorker / Sync path
  └─ NotificationWorker.processChunk
        ├─ NotificationHandlerRegistry → NotificationHandler.resolveModel  (once per chunk)
        └─ RenderAndSendMessageUseCase (injected directly, per message)
              ├─ NotificationMessageRepositoryPort   (claim, markSent/markFailed)
              ├─ NotificationTemplateRepositoryPort  (resolveActive)
              ├─ TemplateRenderer                    (pure render)
              ├─ ChannelProviderRegistry → ChannelProvider.send
              └─ NotificationRequestRepositoryPort   (incrementProgress)
        └─ FinaliseNotificationRequestUseCase (injected directly)
              ├─ NotificationMessageRepositoryPort   (hasInFlightMessages)
              ├─ NotificationRequestRepositoryPort   (finalise)
              └─ NotificationOutboxWriterPort

NotificationController.webhook → ApplyDeliveryEventUseCase (injected directly)
  ├─ ChannelProviderRegistry → ChannelProvider.parseDeliveryReceipt  (verify + translate)
  ├─ NotificationMessageRepositoryPort   (findByProviderMessageId, applyDeliveryStatus)
  └─ NotificationSuppressionRepositoryPort   (on a hard bounce/complaint/STOP)
```

All paths above are relative to `src/platform/notification/` unless noted otherwise.
