import { ClaimExecutionInput, RecurringExecutionRecord } from '../recurring-template.types';

export interface CompleteExecutionInput {
  generatedDocumentId: string;
  generatedSnapshot: Record<string, unknown>;
  conditionEvaluation?: Record<string, unknown>;
  executionTimeMs: number;
}

/**
 * Owned by RecurringModule. `claim()` is the entire idempotency mechanism —
 * it attempts an INSERT on the unique (recurringTemplateId, triggerKey) pair
 * and returns null when that insert violates the constraint (already
 * claimed, exit cleanly) instead of a read-then-write check.
 */
export abstract class RecurringExecutionRepositoryPort {
  abstract claim(input: ClaimExecutionInput): Promise<RecurringExecutionRecord | null>;
  abstract findById(id: string): Promise<RecurringExecutionRecord | null>;
  abstract complete(id: string, input: CompleteExecutionInput): Promise<void>;
  abstract fail(id: string, errorMessage: string): Promise<void>;
  abstract skip(
    id: string,
    skipReason: string,
    conditionEvaluation?: Record<string, unknown>,
  ): Promise<void>;
}
