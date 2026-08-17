import { IntegrationMessage } from '@shared-kernel/ports/message-publisher.port';

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

export abstract class OutboxRepositoryPort {
  abstract save(message: IntegrationMessage): Promise<void>;
  abstract claimBatch(batchSize: number): Promise<OutboxMessageRecord[]>;
  abstract markPublished(id: string): Promise<void>;
  abstract markFailed(id: string, error: string): Promise<void>;
  abstract retryFailed(limit: number): Promise<number>;
  abstract deletePublishedOlderThan(hours: number): Promise<number>;
}
