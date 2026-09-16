import { outboxEventRegistry } from '@platform/events/registries/outbox-event.registry';
import { domainEventRegistry } from '@business/shared-business/domain/registries/domain-event.registry';

/**
 * Composition-root bridge (the only place allowed to know both sides):
 * aggregate modules register their rehydrators into the shared-business
 * singleton, platform services into `outboxEventRegistry`. Wiring the
 * business registry as a read-only DELEGATE lets the outbox publisher
 * rehydrate every event type while `src/platform/**` stays import-free of
 * `@business/**` (enforced by ESLint).
 */
export function configureEventRehydration(): void {
  outboxEventRegistry.addDelegate(domainEventRegistry);
}
