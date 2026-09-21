import { Injectable, Logger } from '@nestjs/common';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { DomainEventEnvelope, EventHandlerRegistration } from '../event-bus.types';
import { DomainEventRegistry } from '../registries/domain-event.registry';

/**
 * Dispatches domain events to registered handlers. Supports handler isolation
 * (one handler failure does not block others) and optional timeout enforcement.
 */
@Injectable()
export class DomainEventDispatcher {
  private readonly logger = new Logger(DomainEventDispatcher.name);

  constructor(private readonly registry: DomainEventRegistry) {}

  /**
   * Dispatch an event to all registered handlers for its type + version.
   * Handler failures are logged but do not prevent other handlers from running
   * (unless failFast is enabled).
   */
  async dispatch(
    event: DomainEventEnvelope,
    options?: { failFast?: boolean; timeoutMs?: number },
  ): Promise<number> {
    const handlers = this.registry.findHandlers(
      event.eventType,
      event.eventVersion,
    );

    if (handlers.length === 0) {
      return 0;
    }

    let dispatched = 0;

    for (const registration of handlers) {
      // Scope filtering — if handler is scoped to a tenant/org, skip if mismatch
      if (registration.tenantId && registration.tenantId !== event.tenantId) {
        continue;
      }
      if (
        registration.organizationId &&
        registration.organizationId !== event.organizationId
      ) {
        continue;
      }

      try {
        await this.invokeHandler(registration, event, options?.timeoutMs);
        dispatched++;
      } catch (err) {
        this.logger.error(
          `Handler ${registration.registrationId} failed for ${event.eventType} (${event.eventId}): ${FailureMessage.of(err)}`,
        );
        if (options?.failFast) {
          throw err;
        }
      }
    }

    return dispatched;
  }

  private async invokeHandler(
    registration: EventHandlerRegistration,
    event: DomainEventEnvelope,
    timeoutMs?: number,
  ): Promise<void> {
    const handlerPromise = registration.handler.handle(
      event as DomainEventEnvelope & { payload: unknown },
    );

    if (!timeoutMs || timeoutMs <= 0) {
      await handlerPromise;
      return;
    }

    const result = await Promise.race([
      handlerPromise.then(() => 'resolved' as const),
      new Promise<'timeout'>(resolve =>
        setTimeout(() => resolve('timeout'), timeoutMs),
      ),
    ]);

    if (result === 'timeout') {
      throw new Error(
        `Handler ${registration.registrationId} timed out after ${timeoutMs}ms for ${event.eventType}`,
      );
    }
  }
}
