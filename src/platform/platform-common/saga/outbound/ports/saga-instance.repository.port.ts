import {
  SagaInstanceReason,
  SagaInstanceRecord,
  SagaInstanceStatus,
  SagaPlan,
} from '../../types/saga.types';

/** Values needed to open a live instance for one correlation key. */
export interface InsertInstanceInput {
  tenantId: string;
  companyId: string;
  sagaKey: string;
  definitionId: string;
  configId: string | null;
  rootRefType: string | null;
  rootRefId: string | null;
  correlationKey: string;
  plan: SagaPlan;
  context: Record<string, unknown>;
  deadlineAt: Date | null;
}

/** Fields a transition may patch; `version` is the CAS fence, never a patch. */
export interface UpdateInstancePatch {
  status?: SagaInstanceStatus;
  reason?: SagaInstanceReason | null;
  cursor?: number;
  waitingEvent?: string | null;
  cancelRequestedAt?: Date | null;
  lastError?: string | null;
  deadlineAt?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  context?: Record<string, unknown>;
  plan?: SagaPlan;
}

/**
 * Outbound port: the `saga_instances` table.
 *
 * One live instance per `(tenant, company, sagaKey, correlationKey)` is enforced
 * by the database through a nullable unique `live_key`, so `tryInsertLive` never
 * needs a read-then-write; every later write is CAS-fenced on `version`.
 */
export abstract class SagaInstanceRepositoryPort {
  /** Insert guarded by the live unique key; `null` when a live instance exists. */
  abstract tryInsertLive(input: InsertInstanceInput): Promise<SagaInstanceRecord | null>;

  abstract findById(id: string): Promise<SagaInstanceRecord | null>;

  abstract findLiveByKey(sagaKey: string, correlationKey: string): Promise<SagaInstanceRecord[]>;

  /** Live instances parked on a WAIT step for `eventName@eventVersion`. */
  abstract findWaitingByEvent(
    eventName: string,
    eventVersion: number,
    limit: number,
  ): Promise<SagaInstanceRecord[]>;

  /** CAS write fenced on `version`; `null` when another writer advanced first. */
  abstract updateCas(
    id: string,
    expectedVersion: number,
    patch: UpdateInstancePatch,
  ): Promise<SagaInstanceRecord | null>;
}
