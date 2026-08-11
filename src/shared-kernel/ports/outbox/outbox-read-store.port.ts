export interface OutboxRecord {
  id: string;
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  tenantId: string;
  organizationId: string | null;
  correlationId: string | null;
  payload: Record<string, unknown>;
  attemptCount: number;
  lastError: string | null;
}

/**
 * Read/projection contract used by the outbox dispatcher to select and update
 * due events. Implemented by an infrastructure adapter backed by Prisma.
 */
export abstract class OutboxReadStorePort {
  public abstract claimNextBatch(batchSize: number, now: Date): Promise<OutboxRecord[]>;
  public abstract markDelivered(id: string, processedAt: Date): Promise<void>;
  public abstract markFailed(id: string, error: string, maxAttempts: number): Promise<'RETRY' | 'DEAD_LETTER'>;
  public abstract countPending(): Promise<number>;
}
