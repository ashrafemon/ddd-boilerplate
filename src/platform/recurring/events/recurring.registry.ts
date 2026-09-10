import { domainEventRegistry } from '@business/shared-business/domain/registries/domain-event.registry';
import { RecurringOccurrenceRequested } from './recurring-occurrence-requested.event';

domainEventRegistry.register('RecurringOccurrenceRequested', payload => {
  return new RecurringOccurrenceRequested(
    asString(payload.executionId),
    asString(payload.recurringTemplateId),
    asString(payload.targetEntityType),
    asNullableString(payload.partyId),
    asNullableString(payload.partyType),
    asString(payload.currency, 'USD'),
    Boolean(payload.autoPost),
    asString(payload.triggerKey),
    asString(payload.traceId),
    (payload.headerOverrides as Record<string, unknown> | null) ?? null,
    Array.isArray(payload.lines) ? payload.lines : [],
    asOptionalString(payload.tenantId),
    payload.eventPayload as Record<string, unknown> | undefined,
  );
});

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
