import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PageResult } from '@shared-kernel/types/pagination';
import { WebhookSubscriptionRepositoryPort } from '../ports/webhook-subscription-repository.port';
import {
  NewWebhookSubscription,
  UpdateWebhookSubscriptionInput,
  WebhookSubscriptionQuery,
  WebhookSubscriptionRecord,
} from '../webhook.types';
import { WebhookSubscriptionNotFoundError } from '../webhook.errors';
import { WebhookMapper } from './webhook.mapper';

@Injectable()
export class PrismaWebhookSubscriptionRepository implements WebhookSubscriptionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async create(input: NewWebhookSubscription): Promise<WebhookSubscriptionRecord> {
    const row = await this.txHost.tx.webhookSubscription.create({
      data: {
        tenantId: input.tenantId,
        url: input.url,
        secret: input.secret,
        eventTypes: input.eventTypes,
        description: input.description ?? null,
      },
    });
    return WebhookMapper.toSubscriptionRecord(row);
  }

  async findById(id: string): Promise<WebhookSubscriptionRecord | null> {
    const row = await this.txHost.tx.webhookSubscription.findUnique({ where: { id } });
    return row ? WebhookMapper.toSubscriptionRecord(row) : null;
  }

  async findActiveByEventType(eventType: string): Promise<WebhookSubscriptionRecord[]> {
    const rows = await this.txHost.tx.webhookSubscription.findMany({
      where: { status: 'ACTIVE', eventTypes: { has: eventType } },
    });
    return rows.map(row => WebhookMapper.toSubscriptionRecord(row));
  }

  async list(query: WebhookSubscriptionQuery): Promise<PageResult<WebhookSubscriptionRecord>> {
    const where = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.txHost.tx.webhookSubscription.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.txHost.tx.webhookSubscription.count({ where }),
    ]);
    return {
      items: rows.map(row => WebhookMapper.toSubscriptionRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async update(
    id: string,
    input: UpdateWebhookSubscriptionInput,
  ): Promise<WebhookSubscriptionRecord> {
    const result = await this.txHost.tx.webhookSubscription.updateMany({
      where: { id },
      data: {
        url: input.url,
        secret: input.secret,
        eventTypes: input.eventTypes,
        status: input.status,
        description: input.description,
      },
    });
    if (result.count === 0) {
      throw new WebhookSubscriptionNotFoundError(id);
    }
    const row = await this.txHost.tx.webhookSubscription.findUniqueOrThrow({ where: { id } });
    return WebhookMapper.toSubscriptionRecord(row);
  }

  async delete(id: string): Promise<void> {
    await this.txHost.tx.webhookSubscription.deleteMany({ where: { id } });
  }

  async recordDeliveryOutcome(
    id: string,
    outcome: { success: boolean },
  ): Promise<WebhookSubscriptionRecord> {
    const row = await this.txHost.tx.webhookSubscription.update({
      where: { id },
      data: outcome.success
        ? { consecutiveFailures: 0, lastSuccessAt: new Date() }
        : { consecutiveFailures: { increment: 1 }, lastFailureAt: new Date() },
    });
    return WebhookMapper.toSubscriptionRecord(row);
  }
}
