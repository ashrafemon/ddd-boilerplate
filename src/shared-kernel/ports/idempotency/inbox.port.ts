/**
 * Consumer-side idempotency (inbox pattern).
 *
 * Message consumers call tryClaim before processing. A duplicate message is
 * skipped, which makes consumers safe against at-least-once delivery.
 */
export abstract class InboxPort {
  public abstract tryClaim(
    messageId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<'PROCESS' | 'DUPLICATE'>;

  public abstract markProcessed(messageId: string, eventType: string): Promise<void>;

  public abstract markFailed(messageId: string, eventType: string, error: string): Promise<void>;
}
