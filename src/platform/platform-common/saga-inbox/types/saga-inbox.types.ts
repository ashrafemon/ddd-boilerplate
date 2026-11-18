/**
 * Saga inbox contracts — the `saga_inbox` ledger (workbook `DB Tables` sheet).
 *
 * One row per (tenant, company, consumer, message) delivery. Events that arrive
 * before their WAIT step are BUFFERED and consumed when the step is reached;
 * events whose step timed out (or that nothing can consume) are IGNORED with a
 * reason so the ledger stays auditable instead of silently dropped.
 *
 * Field names are the contract names; the repository maps the snake_case
 * columns at its edge.
 */

export enum SagaInboxStatus {
  RECEIVED = 'RECEIVED',
  BUFFERED = 'BUFFERED',
  CONSUMED = 'CONSUMED',
  IGNORED = 'IGNORED',
}

export interface SagaInboxRecord {
  id: string;
  tenantId: string;
  companyId: string;
  consumer: string;
  eventId: string;
  eventName: string;
  eventVersion: number;
  correlationKey: string | null;
  instanceId: string | null;
  payload: Record<string, unknown>;
  payloadHash: string | null;
  status: SagaInboxStatus;
  attempts: number;
  receivedAt: Date;
  nextAttemptAt: Date | null;
  lastError: string | null;
}
