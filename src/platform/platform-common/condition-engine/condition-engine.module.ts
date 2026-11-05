import { Module } from '@nestjs/common';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { FieldResolverRegistry } from './field-resolver.registry';
import { ConditionEvaluator } from './ports/condition-evaluator.port';

/**
 * Platform condition-engine — generic AND/OR rule gate (no tables).
 *
 * Flow: ConditionEvaluator.evaluate(GenerationCondition, context) walks each
 * clause, resolving dotted fields through FieldResolverRegistry (owners
 * register a FieldResolver per prefix at bootstrap — the engine imports no
 * module), and returns { passed, evaluatedValues } for audit.
 * Conditions arriving from JSON columns are validated through
 * GenerationConditionParser (single typed boundary, no casts).
 */
@Module({
  providers: [
    FieldResolverRegistry,
    ConditionEvaluationService,
    { provide: ConditionEvaluator, useExisting: ConditionEvaluationService },
  ],
  exports: [ConditionEvaluator, FieldResolverRegistry],
})
export class ConditionEngineModule {}
