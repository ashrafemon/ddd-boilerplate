import {
  NotificationMessageRecord,
  NotificationMessageStatus,
  NotificationMode,
  NotificationPreferenceRecord,
  NotificationPriority,
  NotificationRequestRecord,
  NotificationRequestStatus,
  NotificationSuppressionRecord,
  NotificationTemplateVersion,
} from '../notification.types';

export interface RequestRow {
  id: string;
  tenantId: string | null;
  notificationType: string;
  dedupKey: string;
  sourceEvent: string | null;
  payload: unknown;
  priority: string;
  mode: string;
  status: string;
  totalMessages: number;
  sentMessages: number;
  failedMessages: number;
  suppressedMessages: number;
  requestedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface MessageRow {
  id: string;
  tenantId: string | null;
  notificationRequestId: string;
  recipientRef: string;
  channel: string;
  address: string | null;
  locale: string | null;
  templateId: string | null;
  status: string;
  suppressReason: string | null;
  provider: string | null;
  providerMessageId: string | null;
  renderedSnapshot: unknown;
  errorMessage: string | null;
  attemptCount: number;
  sentAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
}

export interface TemplateRow {
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

interface PreferenceRow {
  id: string;
  tenantId: string | null;
  recipientRef: string;
  category: string;
  channel: string;
  optedIn: boolean;
  quietHoursStart: Date | null;
  quietHoursEnd: Date | null;
  timezone: string | null;
}

interface SuppressionRow {
  id: string;
  tenantId: string | null;
  address: string;
  channel: string;
  reason: string;
  source: string | null;
  suppressedAt: Date;
  expiresAt: Date | null;
}

export class NotificationMapper {
  static toRequestRecord(row: RequestRow): NotificationRequestRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      notificationType: row.notificationType,
      dedupKey: row.dedupKey,
      sourceEvent: row.sourceEvent,
      payload: (row.payload as Record<string, unknown> | null) ?? null,
      priority: row.priority as NotificationPriority,
      mode: row.mode as NotificationMode,
      status: row.status as NotificationRequestStatus,
      totalMessages: row.totalMessages,
      sentMessages: row.sentMessages,
      failedMessages: row.failedMessages,
      suppressedMessages: row.suppressedMessages,
      requestedBy: row.requestedBy,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
    };
  }

  static toMessageRecord(row: MessageRow): NotificationMessageRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      notificationRequestId: row.notificationRequestId,
      recipientRef: row.recipientRef,
      channel: row.channel,
      address: row.address,
      locale: row.locale,
      templateId: row.templateId,
      status: row.status as NotificationMessageStatus,
      suppressReason: row.suppressReason,
      provider: row.provider,
      providerMessageId: row.providerMessageId,
      renderedSnapshot: (row.renderedSnapshot as Record<string, unknown> | null) ?? null,
      errorMessage: row.errorMessage,
      attemptCount: row.attemptCount,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
      createdAt: row.createdAt,
    };
  }

  static toTemplateVersion(row: TemplateRow): NotificationTemplateVersion {
    return {
      id: row.id,
      notificationType: row.notificationType,
      channel: row.channel,
      locale: row.locale,
      version: row.version,
      subject: row.subject,
      body: row.body,
      bodyFormat: row.bodyFormat,
      isActive: row.isActive,
    };
  }

  static toPreferenceRecord(row: PreferenceRow): NotificationPreferenceRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      recipientRef: row.recipientRef,
      category: row.category,
      channel: row.channel,
      optedIn: row.optedIn,
      quietHoursStart: row.quietHoursStart ? formatTime(row.quietHoursStart) : null,
      quietHoursEnd: row.quietHoursEnd ? formatTime(row.quietHoursEnd) : null,
      timezone: row.timezone,
    };
  }

  static toSuppressionRecord(row: SuppressionRow): NotificationSuppressionRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      address: row.address,
      channel: row.channel,
      reason: row.reason,
      source: row.source,
      suppressedAt: row.suppressedAt,
      expiresAt: row.expiresAt,
    };
  }
}

function formatTime(date: Date): string {
  return date.toISOString().slice(11, 19);
}
