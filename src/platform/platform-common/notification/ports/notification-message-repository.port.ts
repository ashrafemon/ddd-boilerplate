import { ClaimedNotificationMessage, NotificationMessageRecord } from '../notification.types';

/**
 * Persistence of notification_messages. The claim
 * (`UPDATE ... WHERE status='PENDING'`) is the send idempotency guarantee —
 * grain #3, distinct from the message UNIQUE (grain #2) enforced at
 * pre-creation by NotificationRequestRepositoryPort.
 */
export abstract class NotificationMessageRepositoryPort {
  /** Message ids for a request, optionally filtered by status (e.g. re-dispatch only Pending). */
  abstract messageIds(requestId: string, status?: 'PENDING' | 'RENDERING'): Promise<string[]>;

  /** True while any message is still non-terminal (Pending or Rendering) — the request is in flight. */
  abstract hasInFlightMessages(requestId: string): Promise<boolean>;

  abstract findByRequestId(requestId: string): Promise<NotificationMessageRecord[]>;

  /**
   * THE send claim: `UPDATE ... SET status='RENDERING' WHERE id=? AND
   * status='PENDING' RETURNING id`. Null means another delivery already
   * claimed it — skip silently, no error.
   */
  abstract claim(messageId: string): Promise<ClaimedNotificationMessage | null>;

  abstract markSent(
    messageId: string,
    input: {
      templateId: string;
      provider: string;
      providerMessageId: string;
      renderedSnapshot: Record<string, unknown> | null;
    },
  ): Promise<void>;

  abstract markFailed(messageId: string, errorMessage: string): Promise<void>;

  /**
   * Applies a delivery receipt only if it advances the message's status
   * (see advancesNotificationMessageStatus). A backward or duplicate event
   * is a silent no-op.
   */
  abstract applyDeliveryStatus(
    providerMessageId: string,
    status: 'DELIVERED' | 'BOUNCED' | 'FAILED',
    reason: string | undefined,
    at: Date,
  ): Promise<NotificationMessageRecord | null>;

  abstract findByProviderMessageId(
    providerMessageId: string,
  ): Promise<NotificationMessageRecord | null>;

  /** Resets messages stuck RENDERING past the window back to PENDING. Returns the count. */
  abstract resetStuckRendering(olderThanMs: number): Promise<number>;

  /** Message ids SENT with no receipt past the window — flagged for review only. */
  abstract findSentWithNoReceipt(olderThanMs: number): Promise<string[]>;
}
