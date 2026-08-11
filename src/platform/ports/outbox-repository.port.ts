import { IntegrationMessage } from '@business/shared-business/ports/message-publisher.port';

export interface OutboxMessageRecord {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  headers: Record<string, string> | null;
  occurredAt: Date;
  publishedAt: Date | null;
  attempts: number;
  lastError: string | null;
  status: 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';
}

export interface OutboxRepositoryPort {
  save(message: IntegrationMessage): Promise<void>;
  claimBatch(batchSize: number): Promise<OutboxMessageRecord[]>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  retryFailed(limit: number): Promise<number>;
  deletePublishedOlderThan(hours: number): Promise<number>;
}

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');
