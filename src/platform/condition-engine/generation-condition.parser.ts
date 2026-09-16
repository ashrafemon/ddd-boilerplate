import { BadRequestException } from '@nestjs/common';
import {
  CONDITION_OPERATORS,
  ConditionOperator,
  GenerationCondition,
} from './ports/condition-evaluator.port';
import { ConditionValue } from './ports/field-resolver.port';

/**
 * Validates the opaque `generationCondition` JSON stored on a template into
 * the typed GenerationCondition contract — one audited boundary instead of
 * scattered `as unknown as` casts.
 */
export class GenerationConditionParser {
  static parse(json: Record<string, unknown> | null | undefined): GenerationCondition | null {
    if (json === null || json === undefined) return null;

    const { logic, clauses } = json;
    if (logic !== 'AND' && logic !== 'OR') {
      throw new BadRequestException("generationCondition.logic must be 'AND' or 'OR'");
    }
    if (!Array.isArray(clauses)) {
      throw new BadRequestException('generationCondition.clauses must be an array');
    }
    return {
      logic,
      clauses: clauses.map((raw, i) => GenerationConditionParser.parseClause(raw, i)),
    };
  }

  private static parseClause(raw: unknown, index: number) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException(`generationCondition.clauses[${index}] must be an object`);
    }
    const { field, operator, value } = raw as Record<string, unknown>;
    if (typeof field !== 'string' || !field) {
      throw new BadRequestException(`generationCondition.clauses[${index}].field is required`);
    }
    if (
      typeof operator !== 'string' ||
      !(CONDITION_OPERATORS as readonly string[]).includes(operator)
    ) {
      throw new BadRequestException(
        `generationCondition.clauses[${index}].operator must be one of: ${CONDITION_OPERATORS.join(', ')}`,
      );
    }
    return {
      field,
      operator: operator as ConditionOperator,
      value: GenerationConditionParser.parseValue(value, index),
    };
  }

  private static parseValue(
    value: unknown,
    clauseIndex: number,
  ): ConditionValue | ConditionValue[] {
    const isValue = (v: unknown): v is ConditionValue =>
      v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
    if (isValue(value)) return value;
    if (Array.isArray(value) && value.every(isValue)) return value;
    throw new BadRequestException(
      `generationCondition.clauses[${clauseIndex}].value must be a scalar or scalar array`,
    );
  }
}
