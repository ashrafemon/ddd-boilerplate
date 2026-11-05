import { PageResult } from '@shared-kernel/types/pagination';
import {
  NewNotificationMessage,
  NotificationListQuery,
  NotificationMessageRecord,
  NotificationMode,
  NotificationPriority,
  NotificationRequestRecord,
} from '../notification.types';

export interface NewNotificationRequest {
  notificationType: string;
  dedupKey: string;
  sourceEvent?: string;
  payload: Record<string, unknown> | null;
  priority: NotificationPriority;
  tenantId: string | null;
  requestedBy: string | null;
}

/**
 * Persistence of notification_requests (header) + notification_messages
 * (fan-out). Two-step by necessity: recipients (and therefore the message
 * count the Sync/Async decision needs) are only known AFTER the domain
 * handler resolves them, which itself needs the request id as context — so
 * the header is created first (1.4), and messages attach once the gate has
 * run (3.1). The dedupKey UNIQUE is enforced on creation.
 */
export abstract class NotificationRequestRepositoryPort {
  abstract findByDedupKey(
    tenantId: string | undefined,
    dedupKey: string,
  ): Promise<NotificationRequestRecord | null>;

  /** Phase 1.4 — header only, status=PENDING, totals zeroed. */
  abstract createRequest(request: NewNotificationRequest): Promise<NotificationRequestRecord>;

  /**
   * Phase 3.1 — writes one message row per surviving/suppressed pair and
   * sets mode + total_messages, in ONE transaction. Called at most once per
   * request. Returns the created message rows so the caller can dispatch the
   * PENDING ones without a second read.
   */
  abstract attachMessages(
    requestId: string,
    mode: NotificationMode,
    messages: NewNotificationMessage[],
  ): Promise<{ request: NotificationRequestRecord; messages: NotificationMessageRecord[] }>;

  abstract findById(requestId: string): Promise<NotificationRequestRecord | null>;

  abstract findWithMessages(
    requestId: string,
  ): Promise<{ request: NotificationRequestRecord; messages: NotificationMessageRecord[] } | null>;

  abstract list(query: NotificationListQuery): Promise<PageResult<NotificationRequestRecord>>;

  /** Marks the request RUNNING and stamps started_at, if it was still PENDING. */
  abstract markRunning(requestId: string): Promise<void>;

  /** Atomically bumps the matching outcome counter (sent/failed/suppressed). */
  abstract incrementProgress(
    requestId: string,
    outcome: 'SENT' | 'FAILED' | 'SUPPRESSED',
  ): Promise<NotificationRequestRecord>;

  /** Terminal status derived from counters + completed_at. */
  abstract finalise(requestId: string): Promise<NotificationRequestRecord>;

  /** Sets status=NO_RECIPIENTS + completed_at — an expected outcome, not an error. */
  abstract finaliseNoRecipients(requestId: string): Promise<NotificationRequestRecord>;

  /** Non-terminal ASYNC requests that still have PENDING messages — for reconciliation re-dispatch. */
  abstract findResumableRequests(): Promise<NotificationRequestRecord[]>;
}
