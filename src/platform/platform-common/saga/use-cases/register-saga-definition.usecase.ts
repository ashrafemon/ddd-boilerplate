import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SagaDefinitionBody, SagaDefinitionStatus } from '../types/saga.types';
import {
  SagaDefinitionValidationError,
  parseSagaDefinition,
} from '../types/saga-definition.parser';
import { SagaDefinitionDocument } from '../types/saga-definition.document';
import { findDefinitionProblems } from '../types/saga-definition.validator';
import { PrismaSagaDefinitionRepository } from '../repositories/prisma-saga-definition.repository';

export interface RegisterSagaDefinitionInput {
  document: SagaDefinitionDocument;
  /** Owning business module (`procurement`); null for a platform default. */
  ownerModule?: string | null;
  status?: SagaDefinitionStatus;
  createdBy?: string;
}

export interface RegisterSagaDefinitionResult {
  /** `false` when `(sagaKey, version)` was already registered — publishing is idempotent. */
  registered: boolean;
  sagaKey: string;
  version: number;
  definitionId: string | null;
}

/**
 * Use case: publish (register) one saga definition.
 *
 * This is workbook `8-Saga` flow step 1: the definition is validated and written
 * as a new `(sagaKey, version)` row; an invalid one is rejected instead of being
 * half-applied. Validation is both structural (`parseSagaDefinition`) and
 * semantic (`findDefinitionProblems`): a step without compensation that is not a
 * pivot, an unparsable condition/template or a bad duration is a publish error,
 * not a runtime surprise. Config changes only ever affect new instances — running
 * instances keep the plan snapshot they started with, which is why a publish
 * never mutates an existing row.
 *
 * Republishing the same version is a no-op: the version number is the contract
 * and two ACTIVE bodies for one version would make the router non-deterministic.
 */
@Injectable()
export class RegisterSagaDefinitionUseCase {
  private readonly logger = new Logger(RegisterSagaDefinitionUseCase.name);

  constructor(private readonly definitions: PrismaSagaDefinitionRepository) {}

  async execute(input: RegisterSagaDefinitionInput): Promise<RegisterSagaDefinitionResult> {
    let definition: SagaDefinitionBody;
    try {
      definition = parseSagaDefinition(input.document);
    } catch (err) {
      if (err instanceof SagaDefinitionValidationError) {
        throw new BadRequestException(`Invalid saga definition: ${err.message}`);
      }
      throw err;
    }

    const problems = findDefinitionProblems(definition);
    if (problems.length > 0) {
      throw new BadRequestException(`Saga definition cannot execute: ${problems.join('; ')}`);
    }

    const existing = await this.definitions.findByKeyVersion(definition.key, definition.version);
    if (existing) {
      this.logger.debug(
        `Saga definition ${definition.key} v${definition.version} already registered`,
      );
      return {
        registered: false,
        sagaKey: definition.key,
        version: definition.version,
        definitionId: existing.id,
      };
    }

    const created = await this.definitions.create({
      sagaKey: definition.key,
      ownerModule: input.ownerModule ?? null,
      status: input.status ?? SagaDefinitionStatus.ACTIVE,
      definition,
      createdBy: input.createdBy ?? 'platform',
    });

    this.logger.log(
      `Registered saga definition ${created.sagaKey} v${created.version} (${created.status})`,
    );
    return {
      registered: true,
      sagaKey: created.sagaKey,
      version: created.version,
      definitionId: created.id,
    };
  }
}
