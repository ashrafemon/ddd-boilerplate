/**
 * Wire shape of the RecurringOccurrenceRequested integration event, owned by
 * THIS module (consumer-side contract — the invoice module never imports
 * platform internals). Must stay structurally compatible with
 * platform/recurring's RecurringOccurrenceRequestedPayload.
 */
export interface RecurringOccurrenceRequestedPayload {
  executionId: string;
  recurringTemplateId: string;
  targetEntityType: string;
  partyId: string | null;
  partyType: string | null;
  currency: string;
  autoPost: boolean;
  triggerKey: string;
  traceId: string;
  tenantId?: string;
  headerOverrides: Record<string, unknown> | null;
  lines: unknown[];
  eventPayload?: Record<string, unknown>;
}
