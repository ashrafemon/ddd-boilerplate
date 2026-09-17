/* eslint-disable @typescript-eslint/require-await -- in-memory test double: the ports are async, the storage is a Map */
import { randomUUID } from 'crypto';
import { PageResult } from '@shared-kernel/types/pagination';
import { NotificationMessageRepositoryPort } from '../ports/notification-message-repository.port';
import { NotificationPreferenceRepositoryPort } from '../ports/notification-preference-repository.port';
import {
  NewNotificationRequest,
  NotificationRequestRepositoryPort,
} from '../ports/notification-request-repository.port';
import { NotificationSuppressionRepositoryPort } from '../ports/notification-suppression-repository.port';
import { NotificationTemplateRepositoryPort } from '../ports/notification-template-repository.port';
import {
  advancesNotificationMessageStatus,
  ClaimedNotificationMessage,
  NewNotificationMessage,
  NotificationListQuery,
  NotificationMessageRecord,
  NotificationMode,
  NotificationPreferenceRecord,
  NotificationRequestRecord,
  NotificationSuppressionRecord,
  NotificationTemplateVersion,
  UpsertNotificationPreferenceInput,
} from '../notification.types';

/**
 * In-memory double for all five notification ports, for unit tests. The
 * message claim and the delivery-status advance check are synchronous
 * check-and-set operations mirroring the production conditional UPDATEs.
 */
export class InMemoryNotificationRepository
  implements
    NotificationRequestRepositoryPort,
    NotificationMessageRepositoryPort,
    NotificationTemplateRepositoryPort,
    NotificationPreferenceRepositoryPort,
    NotificationSuppressionRepositoryPort
{
  readonly requests = new Map<string, NotificationRequestRecord>();
  readonly messages = new Map<string, NotificationMessageRecord>();
  readonly templates: NotificationTemplateVersion[] = [];
  readonly preferences = new Map<string, NotificationPreferenceRecord>();
  readonly suppressions = new Map<string, NotificationSuppressionRecord>();

  // --- NotificationRequestRepositoryPort ---

  async findByDedupKey(
    tenantId: string | undefined,
    dedupKey: string,
  ): Promise<NotificationRequestRecord | null> {
    return (
      [...this.requests.values()].find(
        r => (r.tenantId ?? undefined) === tenantId && r.dedupKey === dedupKey,
      ) ?? null
    );
  }

  async createRequest(request: NewNotificationRequest): Promise<NotificationRequestRecord> {
    const existing = await this.findByDedupKey(request.tenantId ?? undefined, request.dedupKey);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    const now = new Date();
    const record: NotificationRequestRecord = {
      id,
      tenantId: request.tenantId,
      notificationType: request.notificationType,
      dedupKey: request.dedupKey,
      sourceEvent: request.sourceEvent ?? null,
      payload: request.payload,
      priority: request.priority,
      mode: 'ASYNC',
      status: 'PENDING',
      totalMessages: 0,
      sentMessages: 0,
      failedMessages: 0,
      suppressedMessages: 0,
      requestedBy: request.requestedBy,
      startedAt: null,
      completedAt: null,
      createdAt: now,
    };
    this.requests.set(id, record);
    return { ...record };
  }

  async attachMessages(
    requestId: string,
    mode: NotificationMode,
    newMessages: NewNotificationMessage[],
  ): Promise<{ request: NotificationRequestRecord; messages: NotificationMessageRecord[] }> {
    const request = this.requests.get(requestId)!;
    const created = newMessages.map(m => {
      const message: NotificationMessageRecord = {
        id: randomUUID(),
        tenantId: request.tenantId,
        notificationRequestId: requestId,
        recipientRef: m.recipientRef,
        channel: m.channel,
        address: m.address,
        locale: m.locale,
        templateId: null,
        status: m.status,
        suppressReason: m.suppressReason,
        provider: null,
        providerMessageId: null,
        renderedSnapshot: null,
        errorMessage: null,
        attemptCount: 0,
        sentAt: null,
        deliveredAt: null,
        createdAt: new Date(),
      };
      this.messages.set(message.id, message);
      return message;
    });

    request.mode = mode;
    request.totalMessages = created.length;
    request.suppressedMessages = created.filter(m => m.status === 'SUPPRESSED').length;
    request.status = mode === 'SYNC' ? 'RUNNING' : 'PENDING';
    request.startedAt = mode === 'SYNC' ? new Date() : request.startedAt;

    return { request: { ...request }, messages: created.map(m => ({ ...m })) };
  }

  async findById(requestId: string): Promise<NotificationRequestRecord | null> {
    const request = this.requests.get(requestId);
    return request ? { ...request } : null;
  }

  async findWithMessages(
    requestId: string,
  ): Promise<{ request: NotificationRequestRecord; messages: NotificationMessageRecord[] } | null> {
    const request = this.requests.get(requestId);
    if (!request) return null;
    return { request: { ...request }, messages: this.messagesForRequest(requestId) };
  }

  async list(query: NotificationListQuery): Promise<PageResult<NotificationRequestRecord>> {
    const items = [...this.requests.values()].filter(
      r =>
        (!query.status || r.status === query.status) &&
        (!query.notificationType || r.notificationType === query.notificationType),
    );
    return {
      items: items.map(r => ({ ...r })),
      page: 1,
      pageSize: 20,
      total: items.length,
      totalPages: 1,
    };
  }

  async markRunning(requestId: string): Promise<void> {
    const request = this.requests.get(requestId);
    if (request && request.status === 'PENDING') {
      request.status = 'RUNNING';
      request.startedAt = new Date();
    }
  }

  async incrementProgress(
    requestId: string,
    outcome: 'SENT' | 'FAILED' | 'SUPPRESSED',
  ): Promise<NotificationRequestRecord> {
    const request = this.requests.get(requestId)!;
    if (outcome === 'SENT') request.sentMessages += 1;
    else if (outcome === 'FAILED') request.failedMessages += 1;
    else request.suppressedMessages += 1;
    return { ...request };
  }

  async finalise(requestId: string): Promise<NotificationRequestRecord> {
    const request = this.requests.get(requestId)!;
    request.status =
      request.failedMessages === 0
        ? 'COMPLETED'
        : request.sentMessages > 0
          ? 'COMPLETED_WITH_ERRORS'
          : 'FAILED';
    request.completedAt = new Date();
    return { ...request };
  }

  async finaliseNoRecipients(requestId: string): Promise<NotificationRequestRecord> {
    const request = this.requests.get(requestId)!;
    request.status = 'NO_RECIPIENTS';
    request.completedAt = new Date();
    return { ...request };
  }

  async findResumableRequests(): Promise<NotificationRequestRecord[]> {
    return [...this.requests.values()]
      .filter(
        r =>
          r.mode === 'ASYNC' &&
          (r.status === 'PENDING' || r.status === 'RUNNING') &&
          this.messagesForRequest(r.id).some(m => m.status === 'PENDING'),
      )
      .map(r => ({ ...r }));
  }

  // --- NotificationMessageRepositoryPort ---

  async messageIds(requestId: string, status?: 'PENDING' | 'RENDERING'): Promise<string[]> {
    return this.messagesForRequest(requestId)
      .filter(m => !status || m.status === status)
      .map(m => m.id);
  }

  async hasInFlightMessages(requestId: string): Promise<boolean> {
    return this.messagesForRequest(requestId).some(
      m => m.status === 'PENDING' || m.status === 'RENDERING',
    );
  }

  async findByRequestId(requestId: string): Promise<NotificationMessageRecord[]> {
    return this.messagesForRequest(requestId);
  }

  async claim(messageId: string): Promise<ClaimedNotificationMessage | null> {
    const message = this.messages.get(messageId);
    if (!message || message.status !== 'PENDING') return null;
    message.status = 'RENDERING';
    message.attemptCount += 1;
    return {
      id: message.id,
      notificationRequestId: message.notificationRequestId,
      tenantId: message.tenantId,
      recipientRef: message.recipientRef,
      channel: message.channel,
      address: message.address,
      locale: message.locale,
    };
  }

  async markSent(
    messageId: string,
    input: {
      templateId: string;
      provider: string;
      providerMessageId: string;
      renderedSnapshot: Record<string, unknown> | null;
    },
  ): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) return;
    message.status = 'SENT';
    message.templateId = input.templateId;
    message.provider = input.provider;
    message.providerMessageId = input.providerMessageId;
    message.renderedSnapshot = input.renderedSnapshot;
    message.sentAt = new Date();
  }

  async markFailed(messageId: string, errorMessage: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) return;
    message.status = 'FAILED';
    message.errorMessage = errorMessage;
  }

  async applyDeliveryStatus(
    providerMessageId: string,
    status: 'DELIVERED' | 'BOUNCED' | 'FAILED',
    reason: string | undefined,
    at: Date,
  ): Promise<NotificationMessageRecord | null> {
    const message = [...this.messages.values()].find(
      m => m.providerMessageId === providerMessageId,
    );
    if (!message || !advancesNotificationMessageStatus(message.status, status)) {
      return null;
    }
    message.status = status;
    if (status === 'DELIVERED') message.deliveredAt = at;
    if (status === 'BOUNCED' || status === 'FAILED') message.errorMessage = reason ?? null;
    return { ...message };
  }

  async findByProviderMessageId(
    providerMessageId: string,
  ): Promise<NotificationMessageRecord | null> {
    const message = [...this.messages.values()].find(
      m => m.providerMessageId === providerMessageId,
    );
    return message ? { ...message } : null;
  }

  async resetStuckRendering(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    let count = 0;
    for (const message of this.messages.values()) {
      if (message.status === 'RENDERING' && message.createdAt.getTime() < cutoff) {
        message.status = 'PENDING';
        count += 1;
      }
    }
    return count;
  }

  async findSentWithNoReceipt(olderThanMs: number): Promise<string[]> {
    const cutoff = Date.now() - olderThanMs;
    return [...this.messages.values()]
      .filter(m => m.status === 'SENT' && (m.sentAt?.getTime() ?? 0) < cutoff)
      .map(m => m.id);
  }

  // --- NotificationTemplateRepositoryPort ---

  async resolveActive(
    tenantId: string | undefined,
    notificationType: string,
    channel: string,
    locale: string,
  ): Promise<NotificationTemplateVersion | null> {
    const tenantMatch = this.templates
      .filter(
        t =>
          t.notificationType === notificationType &&
          t.channel === channel &&
          t.locale === locale &&
          t.isActive,
      )
      .sort((a, b) => b.version - a.version)[0];
    return tenantMatch ?? null;
  }

  async existsActive(notificationType: string, channel: string): Promise<boolean> {
    return this.templates.some(
      t => t.notificationType === notificationType && t.channel === channel && t.isActive,
    );
  }

  // --- NotificationPreferenceRepositoryPort ---

  async findForRecipient(
    tenantId: string | undefined,
    recipientRef: string,
  ): Promise<NotificationPreferenceRecord[]> {
    return [...this.preferences.values()].filter(
      p => (p.tenantId ?? undefined) === tenantId && p.recipientRef === recipientRef,
    );
  }

  async upsert(input: UpsertNotificationPreferenceInput): Promise<NotificationPreferenceRecord> {
    const key = `${input.tenantId ?? ''}:${input.recipientRef}:${input.category}:${input.channel}`;
    const record: NotificationPreferenceRecord = {
      id: this.preferences.get(key)?.id ?? randomUUID(),
      tenantId: input.tenantId ?? null,
      recipientRef: input.recipientRef,
      category: input.category,
      channel: input.channel,
      optedIn: input.optedIn,
      quietHoursStart: input.quietHoursStart ?? null,
      quietHoursEnd: input.quietHoursEnd ?? null,
      timezone: input.timezone ?? null,
    };
    this.preferences.set(key, record);
    return { ...record };
  }

  // --- NotificationSuppressionRepositoryPort ---

  async isSuppressed(
    tenantId: string | undefined,
    address: string,
    channel: string,
  ): Promise<boolean> {
    const key = `${tenantId ?? ''}:${address}:${channel}`;
    const record = this.suppressions.get(key);
    return !!record && (!record.expiresAt || record.expiresAt.getTime() > Date.now());
  }

  async suppress(
    tenantId: string | undefined,
    address: string,
    channel: string,
    reason: string,
    source?: string,
  ): Promise<NotificationSuppressionRecord> {
    const key = `${tenantId ?? ''}:${address}:${channel}`;
    const record: NotificationSuppressionRecord = {
      id: this.suppressions.get(key)?.id ?? randomUUID(),
      tenantId: tenantId ?? null,
      address,
      channel,
      reason,
      source: source ?? null,
      suppressedAt: new Date(),
      expiresAt: null,
    };
    this.suppressions.set(key, record);
    return { ...record };
  }

  private messagesForRequest(requestId: string): NotificationMessageRecord[] {
    return [...this.messages.values()].filter(m => m.notificationRequestId === requestId);
  }
}
