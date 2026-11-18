import { Injectable, Logger } from '@nestjs/common';
import { SagaDefinitionStatus } from '../types/saga.types';
import { findDefinitionProblems } from '../types/saga-definition.validator';
import { SagaActionResolverPort } from '../outbound/ports/saga-action.port';
import { SagaDefinitionRepositoryPort } from '../outbound/ports/saga-definition.repository.port';

export interface InvalidatedDefinition {
  sagaKey: string;
  version: number;
  problems: string[];
}

export interface ValidateActiveSagaDefinitionsResult {
  checked: number;
  invalidated: InvalidatedDefinition[];
}

/**
 * Use case: flag published definitions that can no longer execute.
 *
 * This is workbook `8-Saga` flow step 9 (`CONFIG_INVALID`): a definition that was
 * valid when published can break later — an action stopped being registered, an
 * expression no longer parses. Rather than throwing on the next trigger, the
 * definition flips to `INVALID`, which means:
 *
 *   - the router (`findActiveByEvent` / `listActive`) never selects it, so **no
 *     new instances** start;
 *   - running instances are untouched — they keep the plan snapshot they were
 *     started with and finish on it;
 *   - the failure is logged at `error` level, which is the alert hook.
 *
 * Nothing is deleted and no body is rewritten, so fixing the cause and flipping
 * the row back to ACTIVE is enough to resume new instances.
 */
@Injectable()
export class ValidateActiveSagaDefinitionsUseCase {
  private readonly logger = new Logger(ValidateActiveSagaDefinitionsUseCase.name);

  constructor(
    private readonly definitions: SagaDefinitionRepositoryPort,
    private readonly actions: SagaActionResolverPort,
  ) {}

  async execute(): Promise<ValidateActiveSagaDefinitionsResult> {
    const active = await this.definitions.listActive();
    const invalidated: InvalidatedDefinition[] = [];

    for (const definition of active) {
      const problems = findDefinitionProblems(definition.definition, this.actions);
      if (problems.length === 0) {
        continue;
      }
      await this.definitions.markStatus(definition.id, SagaDefinitionStatus.INVALID);
      invalidated.push({
        sagaKey: definition.sagaKey,
        version: definition.version,
        problems,
      });
      this.logger.error(
        `Saga definition ${definition.sagaKey} v${definition.version} flagged INVALID: ${problems.join('; ')}`,
      );
    }

    if (invalidated.length === 0) {
      this.logger.debug(`Checked ${active.length} active saga definitions — all executable`);
    }
    return { checked: active.length, invalidated };
  }
}
