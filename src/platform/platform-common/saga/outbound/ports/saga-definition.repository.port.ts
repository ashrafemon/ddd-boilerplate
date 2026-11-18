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

  /** Exact `(sagaKey, version)` lookup — the idempotency check for publishing. */
  abstract findByKeyVersion(sagaKey: string, version: number): Promise<SagaDefinitionRecord | null>;

  abstract create(input: {
    sagaKey: string;
    ownerModule?: string | null;
    status: SagaDefinitionStatus;
    definition: SagaDefinitionBody;
    createdBy?: string;
  }): Promise<SagaDefinitionRecord>;
}
