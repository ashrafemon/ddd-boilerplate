import { Module } from '@nestjs/common';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { FieldResolverRegistry } from './field-resolver.registry';
import { ConditionEvaluator } from './ports/condition-evaluator.port';

/**
 * Condition Engine — generic rule/eligibility gate. Business code injects
 * `ConditionEvaluator`; data-owning modules register `FieldResolver`s into
 * `FieldResolverRegistry` (opt-in, never the other way around).
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
