/**
 * Notification Service vocabulary. `notificationType` and `channel` are opaque
 * strings the pipeline never interprets beyond routing to a handler/provider —
 * same discipline as `aggregateType`/`operationCode` in batch-operation.
 */

export type NotificationPriority = 'HIGH' | 'NORMAL' | 'LOW';
export type NotificationMode = 'SYNC' | 'ASYNC';

export type NotificationRequestStatus =
  'PENDING' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'NO_RECIPIENTS';

export type NotificationMessageStatus =
  'PENDING' | 'RENDERING' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'SUPPRESSED';

/** Why a pair was dropped by the gate before ever reaching a provider. */
export type NotificationSuppressReason =
  'PREFERENCE' | 'HARD_BOUNCE' | 'UNSUBSCRIBE' | 'SMS_STOP' | 'COMPLAINT' | 'MANUAL_BLOCK';

/**
 * Value object passed into every NotificationHandlerPort call. Never the HTTP
 * request — in Async mode there is no request scope at execution time; Sync
 * is treated identically for consistency.
 */
export interface NotificationContext {
  tenantId?: string;
  notificationRequestId: string;
  notificationType: string;
  traceId?: string;
  defaultLocale?: string;
}

export interface Recipient {
  recipientRef: string;
  address?: string;
  locale?: string;
  /** Restricts fan-out to a subset of the notificationType's declared channels. */
  channelHints?: string[];
}

export type TemplateModel = Record<string, unknown>;

/** What a business domain module declares when it opts a notificationType in. */
export interface NotificationHandlerRegistration {
  notificationType: string;
  channels: string[];
  priority: NotificationPriority;
  /** Registers this notificationType against an EVENT — see NotificationEventDispatcher. */
  eventName?: string;
}

export interface ChannelCapabilities {
  channel: string;
  /** ses / sns / twilio / fcm — recorded on the message row for support/audit. */
  providerName: string;
  supportsSubject: boolean;
  maxBodyBytes: number;
  ratePerSecond: number;
}

export interface RenderedMessage {
  address: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface SendReceipt {
  providerMessageId: string;
  acceptedAt: Date;
}

export type DeliveryStatus = 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'COMPLAINT' | 'UNSUBSCRIBED';

export interface DeliveryEvent {
  providerMessageId: string;
  status: DeliveryStatus;
  reason?: string;
  at: Date;
}

export interface NotifyInput {
  notificationType: string;
  dedupKey: string;
  payload?: Record<string, unknown>;
  sourceEvent?: string;
  priority?: NotificationPriority;
  tenantId?: string;
  requestedBy?: string;
  traceId?: string;
}

export interface NewNotificationMessage {
  recipientRef: string;
  channel: string;
  address: string | null;
  locale: string | null;
  status: Extract<NotificationMessageStatus, 'PENDING' | 'SUPPRESSED'>;
  suppressReason: NotificationSuppressReason | null;
}

export interface NotificationRequestRecord {
  id: string;
  tenantId: string | null;
  notificationType: string;
  dedupKey: string;
  sourceEvent: string | null;
  payload: Record<string, unknown> | null;
  priority: NotificationPriority;
  mode: NotificationMode;
  status: NotificationRequestStatus;
  totalMessages: number;
  sentMessages: number;
  failedMessages: number;
  suppressedMessages: number;
  requestedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface NotificationMessageRecord {
  id: string;
  tenantId: string | null;
  notificationRequestId: string;
  recipientRef: string;
  channel: string;
  address: string | null;
  locale: string | null;
  templateId: string | null;
  status: NotificationMessageStatus;
  suppressReason: string | null;
  provider: string | null;
  providerMessageId: string | null;
  renderedSnapshot: Record<string, unknown> | null;
  errorMessage: string | null;
  attemptCount: number;
  sentAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
}

/** A claimed message handed to the render/send use case. */
export interface ClaimedNotificationMessage {
  id: string;
  notificationRequestId: string;
  tenantId: string | null;
  recipientRef: string;
  channel: string;
  address: string | null;
  locale: string | null;
}

/** Everything the worker needs to process a chunk without re-reading the request. */
export interface NotificationDispatch {
  notificationRequestId: string;
  notificationType: string;
  tenantId: string | undefined;
  traceId: string | undefined;
  defaultLocale: string | undefined;
  messageIds: string[];
}

export interface NotificationTemplateVersion {
  id: string;
  notificationType: string;
  channel: string;
  locale: string;
  version: number;
  subject: string | null;
  body: string;
  bodyFormat: string;
  isActive: boolean;
}

export interface NotificationPreferenceRecord {
  id: string;
  tenantId: string | null;
  recipientRef: string;
  category: string;
  channel: string;
  optedIn: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string | null;
}

export interface UpsertNotificationPreferenceInput {
  tenantId?: string;
  recipientRef: string;
  category: string;
  channel: string;
  optedIn: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}

export interface NotificationSuppressionRecord {
  id: string;
  tenantId: string | null;
  address: string;
  channel: string;
  reason: string;
  source: string | null;
  suppressedAt: Date;
  expiresAt: Date | null;
}

export interface NotificationListQuery {
  tenantId?: string;
  status?: NotificationRequestStatus;
  notificationType?: string;
  page: number;
  pageSize: number;
}

/** True once a request can no longer transition — used to skip a redundant finalise. */
export function isTerminalNotificationRequestStatus(status: NotificationRequestStatus): boolean {
  return (
    status === 'COMPLETED' ||
    status === 'COMPLETED_WITH_ERRORS' ||
    status === 'FAILED' ||
    status === 'NO_RECIPIENTS'
  );
}

/** True once a message can no longer move — a late/duplicate receipt must not touch it further. */
export function isTerminalNotificationMessageStatus(status: NotificationMessageStatus): boolean {
  return (
    status === 'DELIVERED' || status === 'BOUNCED' || status === 'FAILED' || status === 'SUPPRESSED'
  );
}

/** Monotonic order — a delivery event may only move a message forward along this sequence. */
const MESSAGE_STATUS_RANK: Record<NotificationMessageStatus, number> = {
  PENDING: 0,
  RENDERING: 1,
  SENT: 2,
  DELIVERED: 3,
  BOUNCED: 3,
  FAILED: 3,
  SUPPRESSED: 3,
};

export function advancesNotificationMessageStatus(
  current: NotificationMessageStatus,
  next: NotificationMessageStatus,
): boolean {
  return MESSAGE_STATUS_RANK[next] > MESSAGE_STATUS_RANK[current];
}
