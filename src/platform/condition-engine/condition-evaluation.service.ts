import { Injectable } from '@nestjs/common';
import { FieldResolverRegistry } from './field-resolver.registry';
import { EvaluationContext } from './ports/field-resolver.port';
import {
  ConditionClause,
  ConditionEvaluationResult,
  ConditionEvaluator,
  GenerationCondition,
} from './ports/condition-evaluator.port';

/**
 * Generic AND/OR clause walker. Knows nothing about Recurring or any domain
 * table — every field value comes from FieldResolverRegistry.
 */
@Injectable()
export class ConditionEvaluationService implements ConditionEvaluator {
  constructor(private readonly fieldResolvers: FieldResolverRegistry) {}

  async evaluate(
    condition: GenerationCondition,
    context: EvaluationContext,
  ): Promise<ConditionEvaluationResult> {
    const evaluatedValues: Record<string, unknown> = {};
    const clauseResults: boolean[] = [];

    for (const clause of condition.clauses) {
      const value = await this.fieldResolvers.resolve(clause.field, context);
      evaluatedValues[clause.field] = value;
      clauseResults.push(matches(value, clause));
    }

    const passed =
      condition.logic === 'AND' ? clauseResults.every(Boolean) : clauseResults.some(Boolean);

    return { passed, evaluatedValues };
  }
}

function matches(resolved: unknown, clause: ConditionClause): boolean {
  const { operator, value } = clause;
  switch (operator) {
    case 'eq':
      return resolved === value;
    case 'neq':
      return resolved !== value;
    case 'gt':
      return compare(resolved, value) === 1;
    case 'gte':
      return compare(resolved, value) >= 0;
    case 'lt':
      return compare(resolved, value) === -1;
    case 'lte':
      return compare(resolved, value) <= 0;
    case 'in':
      return Array.isArray(value) && value.includes(resolved);
    case 'notIn':
      return Array.isArray(value) && !value.includes(resolved);
    default:
      throw new Error(`Unsupported condition operator: ${operator as string}`);
  }
}

/** -1/0/1 for comparable operands, NaN when the pair can't be ordered. */
function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return Math.sign(a - b);
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return NaN;
}
