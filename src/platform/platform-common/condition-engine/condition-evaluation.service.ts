import { Injectable } from '@nestjs/common';
import { FieldResolverRegistry } from './field-resolver.registry';
import { ConditionValue, EvaluationContext } from './ports/field-resolver.port';
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
    const evaluatedValues: Record<string, ConditionValue | undefined> = {};
    const clauseResults: boolean[] = [];

    for (const clause of condition.clauses) {
      const value = await this.fieldResolvers.resolve(clause.field, context);
      evaluatedValues[clause.field] = value;
      clauseResults.push(this.matches(value, clause));
    }

    const passed =
      condition.logic === 'AND' ? clauseResults.every(Boolean) : clauseResults.some(Boolean);

    return { passed, evaluatedValues };
  }

  private matches(resolved: ConditionValue | undefined, clause: ConditionClause): boolean {
    const { operator, value } = clause;
    switch (operator) {
      case 'eq':
        return resolved === value;
      case 'neq':
        return resolved !== value;
      case 'gt':
        return this.compare(resolved, value) === 1;
      case 'gte':
        return this.compare(resolved, value) >= 0;
      case 'lt':
        return this.compare(resolved, value) === -1;
      case 'lte':
        return this.compare(resolved, value) <= 0;
      case 'in':
        return Array.isArray(value) && value.includes(resolved as ConditionValue);
      case 'notIn':
        return Array.isArray(value) && !value.includes(resolved as ConditionValue);
      default:
        throw new Error('Unsupported condition operator');
    }
  }

  /** -1/0/1 for comparable operands, NaN when the pair can't be ordered. */
  private compare(a: ConditionValue | undefined, b: ConditionValue | ConditionValue[]): number {
    if (typeof a === 'number' && typeof b === 'number') return Math.sign(a - b);
    if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
    return NaN;
  }
}
