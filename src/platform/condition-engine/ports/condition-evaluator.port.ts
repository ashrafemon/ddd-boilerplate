import { ConditionValue, EvaluationContext } from './field-resolver.port';

export type ConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn';

export const CONDITION_OPERATORS: readonly ConditionOperator[] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'notIn',
];

export interface ConditionClause {
  field: string;
  operator: ConditionOperator;
  value: ConditionValue | ConditionValue[];
}

/**
 * Generic AND/OR rule shape. Not Recurring-specific — the same shape any
 * future business-rule gate (approval workflow, discount eligibility) will
 * want. See RecurringTemplate.generationCondition for the first caller.
 */
export interface GenerationCondition {
  logic: 'AND' | 'OR';
  clauses: ConditionClause[];
}

export interface ConditionEvaluationResult {
  passed: boolean;
  evaluatedValues: Record<string, ConditionValue | undefined>;
}

/**
 * Declared by ConditionEngineModule. One implementation, shared by every
 * caller. Evaluating is only ever the caller's responsibility to invoke when
 * a condition exists — this service does not decide whether a null/absent
 * condition means "pass".
 */
export abstract class ConditionEvaluator {
  abstract evaluate(
    condition: GenerationCondition,
    context: EvaluationContext,
  ): Promise<ConditionEvaluationResult>;
}
