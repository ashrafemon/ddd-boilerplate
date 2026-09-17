import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '../../../generated/client';
import { PageResult } from '@shared-kernel/types/pagination';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { NotificationMessageRepositoryPort } from '../ports/notification-message-repository.port';
import { NotificationPreferenceRepositoryPort } from '../ports/notification-preference-repository.port';
import {
  NewNotificationRequest,
  NotificationRequestRepositoryPort,
} from '../ports/notification-request-repository.port';
import { NotificationSuppressionRepositoryPort } from '../ports/notification-suppression-repository.port';
import { NotificationTemplateRepositoryPort } from '../ports/notification-template-repository.port';
import {
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
import { MessageRow, NotificationMapper } from './notification.mapper';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * One class, five ports — every notification table is pipeline bookkeeping
 * sharing the same TransactionHost, same shape as
 * PrismaBatchOperationJobRepository's "one class, several ports".
 */
@Injectable()
export class PrismaNotificationRepository
  implements
    NotificationRequestRepositoryPort,
    NotificationMessageRepositoryPort,
    NotificationTemplateRepositoryPort,
    NotificationPreferenceRepositoryPort,
    NotificationSuppressionRepositoryPort
{
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  // ---------------------------------------------------------------------
  // NotificationRequestRepositoryPort
  // ---------------------------------------------------------------------

  async findByDedupKey(
    tenantId: string | undefined,
    dedupKey: string,
  ): Promise<NotificationRequestRecord | null> {
    const row = await this.txHost.tx.notificationRequest.findFirst({
      where: { tenantId: tenantId ?? null, dedupKey },
    });
    return row ? NotificationMapper.toRequestRecord(row) : null;
  }

  async createRequest(request: NewNotificationRequest): Promise<NotificationRequestRecord> {
    try {
      const created = await this.txHost.tx.notificationRequest.create({
        data: {
          notificationType: request.notificationType,
          dedupKey: request.dedupKey,
          sourceEvent: request.sourceEvent ?? null,
          payload: PrismaJson.toInput(request.payload),
          priority: request.priority,
          tenantId: request.tenantId,
          requestedBy: request.requestedBy,
        },
      });
      return NotificationMapper.toRequestRecord(created);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        const existing = await this.findByDedupKey(request.tenantId ?? undefined, request.dedupKey);
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  async attachMessages(
    requestId: string,
    mode: NotificationMode,
    messages: NewNotificationMessage[],
  ): Promise<{ request: NotificationRequestRecord; messages: NotificationMessageRecord[] }> {
    return this.txHost.tx.$transaction(async tx => {
      const request = await tx.notificationRequest.findUniqueOrThrow({ where: { id: requestId } });

      await tx.notificationMessage.createMany({
        data: messages.map(message => ({
          notificationRequestId: requestId,
          tenantId: request.tenantId,
          recipientRef: message.recipientRef,
          channel: message.channel,
          address: message.address,
          locale: message.locale,
          status: message.status,
          suppressReason: message.suppressReason,
        })),
      });

      const suppressedCount = messages.filter(message => message.status === 'SUPPRESSED').length;
      const updated = await tx.notificationRequest.update({
        where: { id: requestId },
        data: {
          mode,
          totalMessages: messages.length,
          suppressedMessages: suppressedCount,
          status: mode === 'SYNC' ? 'RUNNING' : 'PENDING',
          startedAt: mode === 'SYNC' ? new Date() : undefined,
        },
      });

      const createdMessages = await tx.notificationMessage.findMany({
        where: { notificationRequestId: requestId },
        orderBy: { createdAt: 'asc' },
      });

      return {
        request: NotificationMapper.toRequestRecord(updated),
        messages: createdMessages.map(row => NotificationMapper.toMessageRecord(row)),
      };
    });
  }

  async findById(requestId: string): Promise<NotificationRequestRecord | null> {
    const row = await this.txHost.tx.notificationRequest.findUnique({ where: { id: requestId } });
    return row ? NotificationMapper.toRequestRecord(row) : null;
  }

  async findWithMessages(
    requestId: string,
  ): Promise<{ request: NotificationRequestRecord; messages: NotificationMessageRecord[] } | null> {
    const row = await this.txHost.tx.notificationRequest.findUnique({
      where: { id: requestId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) {
      return null;
    }
    const { messages, ...header } = row;
    return {
      request: NotificationMapper.toRequestRecord(header),
      messages: messages.map(row => NotificationMapper.toMessageRecord(row)),
    };
  }

  async list(query: NotificationListQuery): Promise<PageResult<NotificationRequestRecord>> {
    const where = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.notificationType ? { notificationType: query.notificationType } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.txHost.tx.notificationRequest.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.txHost.tx.notificationRequest.count({ where }),
    ]);
    return {
      items: rows.map(row => NotificationMapper.toRequestRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async markRunning(requestId: string): Promise<void> {
    await this.txHost.tx.notificationRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
  }

  async incrementProgress(
    requestId: string,
    outcome: 'SENT' | 'FAILED' | 'SUPPRESSED',
  ): Promise<NotificationRequestRecord> {
    const counter =
      outcome === 'SENT'
        ? { sentMessages: { increment: 1 } }
        : outcome === 'FAILED'
          ? { failedMessages: { increment: 1 } }
          : { suppressedMessages: { increment: 1 } };

    const row = await this.txHost.tx.notificationRequest.update({
      where: { id: requestId },
      data: counter,
    });
    return NotificationMapper.toRequestRecord(row);
  }

  async finalise(requestId: string): Promise<NotificationRequestRecord> {
    const request = await this.txHost.tx.notificationRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    const status =
      request.failedMessages === 0
        ? 'COMPLETED'
        : request.sentMessages > 0
          ? 'COMPLETED_WITH_ERRORS'
          : 'FAILED';

    const row = await this.txHost.tx.notificationRequest.update({
      where: { id: requestId },
      data: { status, completedAt: new Date() },
    });
    return NotificationMapper.toRequestRecord(row);
  }

  async finaliseNoRecipients(requestId: string): Promise<NotificationRequestRecord> {
    const row = await this.txHost.tx.notificationRequest.update({
      where: { id: requestId },
      data: { status: 'NO_RECIPIENTS', completedAt: new Date() },
    });
    return NotificationMapper.toRequestRecord(row);
  }

  async findResumableRequests(): Promise<NotificationRequestRecord[]> {
    const rows = await this.txHost.tx.notificationRequest.findMany({
      where: {
        mode: 'ASYNC',
        status: { in: ['PENDING', 'RUNNING'] },
        messages: { some: { status: 'PENDING' } },
      },
      take: 100,
    });
    return rows.map(row => NotificationMapper.toRequestRecord(row));
  }

  // ---------------------------------------------------------------------
  // NotificationMessageRepositoryPort
  // ---------------------------------------------------------------------

  async messageIds(requestId: string, status?: 'PENDING' | 'RENDERING'): Promise<string[]> {
    const rows = await this.txHost.tx.notificationMessage.findMany({
      where: { notificationRequestId: requestId, ...(status ? { status } : {}) },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(row => row.id);
  }

  async hasInFlightMessages(requestId: string): Promise<boolean> {
    const count = await this.txHost.tx.notificationMessage.count({
      where: { notificationRequestId: requestId, status: { in: ['PENDING', 'RENDERING'] } },
    });
    return count > 0;
  }

  async findByRequestId(requestId: string): Promise<NotificationMessageRecord[]> {
    const rows = await this.txHost.tx.notificationMessage.findMany({
      where: { notificationRequestId: requestId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(row => NotificationMapper.toMessageRecord(row));
  }

  async claim(messageId: string): Promise<ClaimedNotificationMessage | null> {
    const claimed = await this.txHost.tx.$queryRaw<ClaimedNotificationMessage[]>`
      UPDATE "notification_messages"
      SET status = 'RENDERING', "updatedAt" = now(), "attemptCount" = "attemptCount" + 1
      WHERE id = ${messageId}::uuid AND status = 'PENDING'
      RETURNING id, "notificationRequestId", "tenantId", "recipientRef", channel, address, locale
    `;
    return claimed[0] ?? null;
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
    await this.txHost.tx.notificationMessage.update({
      where: { id: messageId },
      data: {
        status: 'SENT',
        templateId: input.templateId,
        provider: input.provider,
        providerMessageId: input.providerMessageId,
        renderedSnapshot: PrismaJson.toInput(input.renderedSnapshot),
        sentAt: new Date(),
      },
    });
  }

  async markFailed(messageId: string, errorMessage: string): Promise<void> {
    await this.txHost.tx.notificationMessage.update({
      where: { id: messageId },
      data: { status: 'FAILED', errorMessage: errorMessage.slice(0, 4000) },
    });
  }

  /**
   * The monotonic advance check happens INSIDE the SQL (rank comparison), not
   * in application code, so a concurrent duplicate webhook can never race
   * past it — only the update that strictly increases rank is ever applied.
   */
  async applyDeliveryStatus(
    providerMessageId: string,
    status: 'DELIVERED' | 'BOUNCED' | 'FAILED',
    reason: string | undefined,
    at: Date,
  ): Promise<NotificationMessageRecord | null> {
    const rows = await this.txHost.tx.$queryRaw<MessageRow[]>`
      UPDATE "notification_messages"
      SET status = ${status}::"NotificationMessageStatus",
          "errorMessage" = CASE WHEN ${status} IN ('BOUNCED', 'FAILED') THEN ${reason ?? null} ELSE "errorMessage" END,
          "deliveredAt" = CASE WHEN ${status} = 'DELIVERED' THEN ${at} ELSE "deliveredAt" END,
          "updatedAt" = now()
      WHERE "providerMessageId" = ${providerMessageId}
        AND (CASE status
              WHEN 'PENDING' THEN 0 WHEN 'RENDERING' THEN 1 WHEN 'SENT' THEN 2 ELSE 3 END)
          < (CASE ${status}::"NotificationMessageStatus"
              WHEN 'PENDING' THEN 0 WHEN 'RENDERING' THEN 1 WHEN 'SENT' THEN 2 ELSE 3 END)
      RETURNING *
    `;
    return rows[0] ? NotificationMapper.toMessageRecord(rows[0]) : null;
  }

  async findByProviderMessageId(
    providerMessageId: string,
  ): Promise<NotificationMessageRecord | null> {
    const row = await this.txHost.tx.notificationMessage.findFirst({
      where: { providerMessageId },
    });
    return row ? NotificationMapper.toMessageRecord(row) : null;
  }

  async resetStuckRendering(olderThanMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const result = await this.txHost.tx.notificationMessage.updateMany({
      where: { status: 'RENDERING', updatedAt: { lt: cutoff } },
      data: { status: 'PENDING' },
    });
    return result.count;
  }

  async findSentWithNoReceipt(olderThanMs: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const rows = await this.txHost.tx.notificationMessage.findMany({
      where: { status: 'SENT', sentAt: { lt: cutoff } },
      select: { id: true },
      take: 500,
    });
    return rows.map(row => row.id);
  }

  // ---------------------------------------------------------------------
  // NotificationTemplateRepositoryPort
  // ---------------------------------------------------------------------

  async resolveActive(
    tenantId: string | undefined,
    notificationType: string,
    channel: string,
    locale: string,
  ): Promise<NotificationTemplateVersion | null> {
    if (tenantId) {
      const tenantRow = await this.txHost.tx.notificationTemplate.findFirst({
        where: { tenantId, notificationType, channel, locale, isActive: true },
        orderBy: { version: 'desc' },
      });
      if (tenantRow) {
        return NotificationMapper.toTemplateVersion(tenantRow);
      }
    }

    const platformRow = await this.txHost.tx.notificationTemplate.findFirst({
      where: { tenantId: null, notificationType, channel, locale, isActive: true },
      orderBy: { version: 'desc' },
    });
    return platformRow ? NotificationMapper.toTemplateVersion(platformRow) : null;
  }

  async existsActive(notificationType: string, channel: string): Promise<boolean> {
    const count = await this.txHost.tx.notificationTemplate.count({
      where: { notificationType, channel, isActive: true },
    });
    return count > 0;
  }

  // ---------------------------------------------------------------------
  // NotificationPreferenceRepositoryPort
  // ---------------------------------------------------------------------

  async findForRecipient(
    tenantId: string | undefined,
    recipientRef: string,
  ): Promise<NotificationPreferenceRecord[]> {
    const rows = await this.txHost.tx.notificationPreference.findMany({
      where: { tenantId: tenantId ?? null, recipientRef },
    });
    return rows.map(row => NotificationMapper.toPreferenceRecord(row));
  }

  /**
   * Prisma's compound-unique `where` shorthand rejects `null` for a nullable
   * column (Postgres treats NULL as distinct in a unique index, so the
   * generated type only accepts a concrete string) — find-then-write instead
   * of `.upsert()` so a platform-wide (tenantId = null) preference works the
   * same as a tenant-scoped one.
   */
  async upsert(input: UpsertNotificationPreferenceInput): Promise<NotificationPreferenceRecord> {
    const tenantId = input.tenantId ?? null;
    const existing = await this.txHost.tx.notificationPreference.findFirst({
      where: {
        tenantId,
        recipientRef: input.recipientRef,
        category: input.category,
        channel: input.channel,
      },
    });

    const data = {
      optedIn: input.optedIn,
      quietHoursStart: toTimeOrNull(input.quietHoursStart),
      quietHoursEnd: toTimeOrNull(input.quietHoursEnd),
      timezone: input.timezone,
    };

    const row = existing
      ? await this.txHost.tx.notificationPreference.update({ where: { id: existing.id }, data })
      : await this.txHost.tx.notificationPreference.create({
          data: {
            tenantId,
            recipientRef: input.recipientRef,
            category: input.category,
            channel: input.channel,
            ...data,
          },
        });
    return NotificationMapper.toPreferenceRecord(row);
  }

  // ---------------------------------------------------------------------
  // NotificationSuppressionRepositoryPort
  // ---------------------------------------------------------------------

  async isSuppressed(
    tenantId: string | undefined,
    address: string,
    channel: string,
  ): Promise<boolean> {
    const row = await this.txHost.tx.notificationSuppression.findFirst({
      where: {
        tenantId: tenantId ?? null,
        address,
        channel,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return row !== null;
  }

  /** Find-then-write for the same nullable-tenantId reason as upsert() above. */
  async suppress(
    tenantId: string | undefined,
    address: string,
    channel: string,
    reason: string,
    source?: string,
  ): Promise<NotificationSuppressionRecord> {
    const scopedTenantId = tenantId ?? null;
    const existing = await this.txHost.tx.notificationSuppression.findFirst({
      where: { tenantId: scopedTenantId, address, channel },
    });

    const data = { reason, source: source ?? null, suppressedAt: new Date() };
    const row = existing
      ? await this.txHost.tx.notificationSuppression.update({ where: { id: existing.id }, data })
      : await this.txHost.tx.notificationSuppression.create({
          data: { tenantId: scopedTenantId, address, channel, ...data },
        });
    return NotificationMapper.toSuppressionRecord(row);
  }
}

function toTimeOrNull(value: string | undefined): Date | null {
  return value ? new Date(`1970-01-01T${value}Z`) : null;
}
