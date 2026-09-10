import { EvaluationContext } from '@platform/condition-engine/ports/field-resolver.port';

/**
 * Structurally satisfies condition-engine's EvaluationContext without this
 * module importing it — a RecurringContext value is passed anywhere an
 * EvaluationContext parameter is expected.
 */
export interface RecurringContext extends EvaluationContext {
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
  eventPayload?: Record<string, unknown>;
}

export interface ResolvedHeader {
  partyId: string;
  partyType: string;
  currency: string;
  [key: string]: unknown;
}
