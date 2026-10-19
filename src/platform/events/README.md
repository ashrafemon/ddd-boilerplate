# platform/events — In-Process Dispatch Only

> Best-effort local notification inside the monolith. Durability belongs to
> Outbox; transport belongs to Message Queue. This module is a **thin emit
> wrapper** over `EventEmitter2` — no routing table, no registries, no
> rehydration.

## What it does

- `InProcessEventBus.emit(envelope)` fans out the canonical transport envelope
  to local `@OnEvent('<EventType>')` listeners. At-most-once, no retries, no
  storage, no DLQ — a lost emission never blocks anything.
- The adapter emits on `envelope.eventType`, so listeners (and `onAny`
  projections) receive the exact same envelope the brokers carry and read the
  business payload from `message.payload`.
- `eventId` / `correlationId` / `causationId` / `tenantId` ride on the envelope
  (no rehydration step).

## Public API

```ts
import { InProcessEventBus } from '@platform/events/ports/in-process-event-bus.port';

// publisher (usually the outbox, not business code)
await this.eventBus.emit(envelope);

// subscriber (business listener file — delegates, never inline logic)
@OnEvent('ProductCreated')
handleProductCreated(message: MessageEnvelope) {
  return this.productUseCase.execute(message.payload);
}
```

## Layout

```
ports/
  in-process-event-bus.port.ts   — public port (emit) + MessageEnvelope alias
services/
  event-bus.service.ts           — facade implementing InProcessEventBus
usecases/
  emit-event.usecase.ts          — forwards to the Nest adapter
adapters/
  nest-event-bus.adapter.ts      — wraps EventEmitter2 wildcard dispatch
events.module.ts
```

No `repositories/`, no config file, no routing table.

## Who calls it / how called

| Consumer             | How                                              |
| -------------------- | ------------------------------------------------ |
| `platform/outbox`    | Emits the canonical envelope after broker publish |
| Any use case         | Direct `emit` for local-only projections          |
| Business listeners   | `@OnEvent('<EventType>')` reading `message.payload` |

## Tenancy behaviour

None of its own — the envelope carries `tenantId`/`organizationId`; the outbox
restores CLS before emitting.

## Rules & gotchas

- **One listener failure must not break others.** The adapter wraps the emit in
  a try/catch and logs; keep listeners idempotent and non-throwing.
- If a reaction must survive a crash, go through the **Outbox** — never emit
  directly.
- Zero `@business/**` imports; never `@Global`.
