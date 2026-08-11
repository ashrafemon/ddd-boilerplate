import { Injectable } from '@nestjs/common';
import { InboxPort } from '../../shared-kernel/ports/idempotency/inbox.port';

export type IdempotencyDecision = 'PROCESS' | 'DUPLICATE';

/**
 * Consumer-side idempotency service (inbox pattern).
 *
 * Message consumers ask `shouldProcess` before handling a message: a duplicate
 * message (already claimed by another consumer or a redelivery) is skipped,
 * which makes consumers safe against at-least-once delivery. The underlying
 * inbox records are tracked through `InboxPort`, implemented by the
 * infrastructure layer.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly inbox: InboxPort) {}

  public async shouldProcess(
    messageId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    const decision = await this.inbox.tryClaim(messageId, eventType, payload);
    return decision === 'PROCESS';
  }

  public async markProcessed(messageId: string, eventType: string): Promise<void> {
    await this.inbox.markProcessed(messageId, eventType);
  }

  public async markFailed(messageId: string, eventType: string, error: string): Promise<void> {
    await this.inbox.markFailed(messageId, eventType, error);
  }
}
