import { SagaDefinitionBody, SagaStepSpec } from './saga.types';
import { parseDuration, validateExpression, validateTemplate } from './saga-expression';

/**
 * Semantic checks that a definition can actually run.
 *
 * `parseSagaDefinition` answers "is this a definition at all" (shape, enums,
 * required fields). This module answers "can the engine execute it": every
 * `do` is reversible (or past the pivot), every condition parses, every template
 * renders, every duration is ISO-8601. Two callers share it:
 *
 *   - `RegisterSagaDefinitionUseCase` — reject the publish (workbook `8-Saga`
 *     flow 1: "bad expression or failed checks reject the publish");
 *   - `ValidateActiveSagaDefinitionsUseCase` — flag an already published
 *     definition `INVALID` when its actions disappear (flow 9: no new
 *     instances, alert).
 */

/** Optional action lookup; omitted when actions are not known yet. */
export interface SagaActionProbe {
  has(name: string): boolean;
}

function checkExpression(problems: string[], label: string, source: string | undefined): void {
  if (!source) {
    return;
  }
  const problem = validateExpression(source);
  if (problem) {
    problems.push(`${label}: ${problem}`);
  }
}

function checkTemplate(problems: string[], label: string, template: string | undefined): void {
  if (!template) {
    return;
  }
  const problem = validateTemplate(template);
  if (problem) {
    problems.push(`${label}: ${problem}`);
  }
}

function checkStep(problems: string[], step: SagaStepSpec, actions?: SagaActionProbe): void {
  const id = `step "${step.id}"`;

  if (step.do && !step.undo && !step.pivot) {
    problems.push(`${id} has no compensation and is not a pivot step`);
  }
  if (step.do && actions && !actions.has(step.do)) {
    problems.push(`${id} action "${step.do}" is not registered`);
  }
  if (step.undo && actions && !actions.has(step.undo)) {
    problems.push(`${id} compensation "${step.undo}" is not registered`);
  }
  if (step.waitFor && !step.match) {
    problems.push(`${id} waits for an event without a match template`);
  }

  checkExpression(problems, `${id} if`, step.if);
  checkExpression(problems, `${id} when`, step.when);
  checkTemplate(problems, `${id} match`, step.match);
  for (const [field, expression] of Object.entries(step.input ?? {})) {
    checkExpression(problems, `${id} input.${field}`, expression);
  }
  if (step.timeout) {
    try {
      parseDuration(step.timeout);
    } catch (err) {
      problems.push(`${id} timeout: ${(err as Error).message}`);
    }
  }
  if (step.retry && step.retry.maxAttempts < 1) {
    problems.push(`${id} retry.maxAttempts must be at least 1`);
  }
}

/**
 * Return every reason the definition cannot run, in a stable order.
 * An empty list means it is executable as published.
 */
export function findDefinitionProblems(
  definition: SagaDefinitionBody,
  actions?: SagaActionProbe,
): string[] {
  const problems: string[] = [];

  checkTemplate(problems, 'start.key', definition.start.key);
  checkExpression(problems, 'start.when', definition.start.when);
  for (const [field, expression] of Object.entries(definition.start.context ?? {})) {
    checkExpression(problems, `start.context.${field}`, expression);
  }

  for (const step of definition.steps) {
    checkStep(problems, step, actions);
  }

  // A WAIT-only plan can never do anything; it would park forever.
  if (definition.steps.every(step => !step.do)) {
    problems.push('definition has no action step — nothing would ever execute');
  }

  return problems;
}
