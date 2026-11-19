import { Injectable } from '@nestjs/common';
import {
  SagaDefinitionBody,
  SagaOnTimeout,
  SagaOverlay,
  SagaPlan,
  SagaPlanStep,
  SagaStepKind,
} from '../types/saga.types';

export interface PlanBuildInput {
  definition: SagaDefinitionBody;
  overlay: SagaOverlay | null;
  /** Feature keys enabled for the company. */
  features: ReadonlySet<string>;
  /** Company settings, snapshotted into the context by the router. */
  settings: Record<string, unknown>;
  defaultMaxAttempts: number;
}

function andConditions(left?: string, right?: string): string | undefined {
  const present = [left, right].filter((c): c is string => Boolean(c && c.trim()));
  if (present.length === 0) {
    return undefined;
  }
  if (present.length === 1) {
    return present[0];
  }
  return present.map(c => `(${c})`).join(' && ');
}

function hasAll(required: string[] | undefined, features: ReadonlySet<string>): boolean {
  return !required || required.every(key => features.has(key));
}

/**
 * BuildSagaPlanUseCase — merges the platform default with the company overlay.
 *
 * Overlays only narrow: conditions are AND-combined, timing/retry overridden,
 * optional steps switched on and standard steps switched off — never required
 * steps off, never new steps. A required step whose features are missing means
 * the saga does not exist for that company; an empty plan means no instance.
 */
@Injectable()
export class BuildSagaPlanUseCase {
  execute(input: PlanBuildInput): SagaPlan | null {
    const { definition, overlay, features, defaultMaxAttempts } = input;

    if (overlay?.enabled === false) {
      return null;
    }
    if (!hasAll(definition.requires, features)) {
      return null;
    }

    const steps: SagaPlanStep[] = [];
    for (const spec of definition.steps) {
      const stepOverlay = overlay?.steps?.[spec.id];

      const enabled =
        spec.policy === 'required'
          ? true
          : spec.policy === 'optional'
            ? (stepOverlay?.enabled ?? false)
            : (stepOverlay?.enabled ?? true);
      if (!enabled) {
        continue;
      }

      if (!hasAll(spec.requires, features)) {
        if (spec.policy === 'required') {
          // The company cannot produce what a required step needs → no saga.
          return null;
        }
        continue;
      }

      if (!spec.do && !spec.waitFor) {
        continue;
      }

      const isWait = Boolean(spec.waitFor);
      const maxAttempts =
        stepOverlay?.retry?.maxAttempts ?? spec.retry?.maxAttempts ?? defaultMaxAttempts;
      const timeout = stepOverlay?.timeout ?? spec.timeout;
      const onTimeout: SagaOnTimeout | undefined = isWait ? (spec.onTimeout ?? 'skip') : undefined;

      steps.push({
        id: spec.id,
        kind: isWait ? SagaStepKind.WAIT : SagaStepKind.DO,
        action: spec.do,
        undo: spec.undo,
        input: spec.input,
        waitFor: spec.waitFor,
        match: spec.match,
        when: andConditions(spec.when, stepOverlay?.when),
        if: andConditions(spec.if, stepOverlay?.if),
        timeout,
        onTimeout,
        maxAttempts,
        pivot: spec.pivot ?? false,
      });
    }

    if (steps.length === 0) {
      return null;
    }

    return {
      sagaKey: definition.key,
      version: definition.version,
      steps,
      cancelOn: definition.cancelOn ?? [],
      onComplete: definition.onComplete,
    };
  }
}
