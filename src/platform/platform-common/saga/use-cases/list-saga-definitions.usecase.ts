import { Injectable } from '@nestjs/common';
import { SagaDefinitionRecord, SagaDefinitionStatus } from '../types/saga.types';
import { PrismaSagaDefinitionRepository } from '../repositories/prisma-saga-definition.repository';

export interface ListSagaDefinitionsInput {
  status?: SagaDefinitionStatus;
  sagaKey?: string;
}

/**
 * Use case: read the runtime saga catalogue.
 *
 * Definitions are data, not code: this is the operator's view of what the engine
 * currently knows, in any status — ACTIVE (routable), DRAFT (not yet published),
 * INVALID (failed validation, invisible to the router) and RETIRED (superseded).
 */
@Injectable()
export class ListSagaDefinitionsUseCase {
  constructor(private readonly definitions: PrismaSagaDefinitionRepository) {}

  async execute(input: ListSagaDefinitionsInput = {}): Promise<SagaDefinitionRecord[]> {
    return this.definitions.listAll(input);
  }
}
