import {
  SagaDefinitionBody,
  SagaDefinitionRecord,
  SagaDefinitionStatus,
} from '../../types/saga.types';

/**
 * Outbound port: the `saga_definitions` table (platform defaults).
 *
 * Definitions are versioned by `(sagaKey, version)`; the router always reads the
 * ACTIVE row for the event contract it was triggered by.
 */
export abstract class SagaDefinitionRepositoryPort {
  abstract findActiveByEvent(
    eventName: string,
    eventVersion: number,
  ): Promise<SagaDefinitionRecord | null>;

  abstract findActiveByKey(sagaKey: string): Promise<SagaDefinitionRecord | null>;

  /** All ACTIVE definitions — a bounded set the router filters in memory. */
  abstract listActive(): Promise<SagaDefinitionRecord[]>;

  /** Every definition in any status — the runtime catalogue (operator view). */
  abstract listAll(filter?: {
    status?: SagaDefinitionStatus;
    sagaKey?: string;
  }): Promise<SagaDefinitionRecord[]>;

  abstract findById(id: string): Promise<SagaDefinitionRecord | null>;

  /** Exact `(sagaKey, version)` lookup — the idempotency check for publishing. */
  abstract findByKeyVersion(sagaKey: string, version: number): Promise<SagaDefinitionRecord | null>;

  /**
   * Flip the lifecycle status of one definition (ACTIVE → INVALID / RETIRED).
   * Never touches the body: a running instance keeps its plan snapshot.
   */
  abstract markStatus(id: string, status: SagaDefinitionStatus): Promise<void>;

  abstract create(input: {
    sagaKey: string;
    ownerModule?: string | null;
    status: SagaDefinitionStatus;
    definition: SagaDefinitionBody;
    createdBy?: string;
  }): Promise<SagaDefinitionRecord>;
}
