import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SagaDefinitionRecord, SagaDefinitionStatus } from '../types/saga.types';
import { findDefinitionProblems } from '../types/saga-definition.validator';
import { SagaDefinitionRepositoryPort } from '../outbound/ports/saga-definition.repository.port';

export interface SetSagaDefinitionStatusInput {
  definitionId: string;
  status: Extract<SagaDefinitionStatus, 'ACTIVE' | 'RETIRED'>;
}

/**
 * Use case: flip one definition between ACTIVE and RETIRED.
 *
 * Re-activation re-validates the stored body, so a definition marked INVALID
 * cannot be brought back by a status flip alone — the operator has to publish a
 * corrected version. Retirement is the only supported removal: it never touches
 * the body, and instances already running keep the plan snapshot they started
 * with, so in-flight work finishes under the contract it began with.
 */
@Injectable()
export class SetSagaDefinitionStatusUseCase {
  private readonly logger = new Logger(SetSagaDefinitionStatusUseCase.name);

  constructor(private readonly definitions: SagaDefinitionRepositoryPort) {}

  async execute(input: SetSagaDefinitionStatusInput): Promise<SagaDefinitionRecord> {
    const record = await this.definitions.findById(input.definitionId);
    if (!record) {
      throw new NotFoundException('Saga definition not found');
    }

    if (input.status === SagaDefinitionStatus.ACTIVE) {
      const problems = findDefinitionProblems(record.definition);
      if (problems.length > 0) {
        throw new BadRequestException(
          `Saga definition cannot execute: ${problems.join('; ')} — publish a corrected version`,
        );
      }
    }

    await this.definitions.markStatus(record.id, input.status);
    this.logger.log(`Saga definition ${record.sagaKey} v${record.version} → ${input.status}`);

    return { ...record, status: input.status };
  }
}
