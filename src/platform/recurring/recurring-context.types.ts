import { JsonObject } from '@shared-kernel/types/json-value.type';

/**
 * Structurally satisfies condition-engine's EvaluationContext without this
 * module importing it — a RecurringContext value is passed anywhere an
 * EvaluationContext parameter is expected.
 */
export interface RecurringContext {
  tenantId?: string;
  recurringTemplateId: string;
  triggerKey: string;
  traceId: string;
  /** Set after the execution row is claimed. */
  executionId?: string;
  /** Copied from the template so a deferred generator can include it on the command. */
  autoPost?: boolean;
  /**
   * EVENT-triggered only — the payload the source event carried (e.g.
   * { itemId } for a reorder-point PO). TIME-triggered executions leave
   * this undefined.
   */
  eventPayload?: JsonObject;
}
