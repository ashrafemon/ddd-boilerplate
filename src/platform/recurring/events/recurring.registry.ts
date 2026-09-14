import { JsonObject, JsonValue } from '@shared-kernel/types/json-value.type';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { domainEventRegistry } from '@business/shared-business/domain/registries/domain-event.registry';
import { RecurringOccurrenceRequested } from './recurring-occurrence-requested.event';

class RecurringOccurrenceRehydrator {
  static register(): void {
    domainEventRegistry.register(
      'RecurringOccurrenceRequested',
      payload =>
        new RecurringOccurrenceRequested(
          this.string(payload.executionId),
          this.string(payload.recurringTemplateId),
          this.string(payload.targetEntityType),
          this.nullableString(payload.partyId),
          this.nullableString(payload.partyType),
          this.string(payload.currency, 'USD'),
          payload.autoPost === true,
          this.string(payload.triggerKey),
          this.string(payload.traceId),
          PrismaJson.as<JsonObject>(payload.headerOverrides),
          PrismaJson.as<JsonValue[]>(payload.lines) ?? [],
          this.optionalString(payload.tenantId),
          PrismaJson.as<JsonObject>(payload.eventPayload) ?? undefined,
        ),
    );
  }

  private static string(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
  }

  private static optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private static nullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }
}

RecurringOccurrenceRehydrator.register();
