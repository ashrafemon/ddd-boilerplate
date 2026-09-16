/* eslint-disable @typescript-eslint/require-await -- in-memory test double: the port is async, the storage is a Map */
import { randomUUID } from 'crypto';
import { PageResult } from '@shared-kernel/types/pagination';
import { WebhookSubscriptionRepositoryPort } from '../ports/webhook-subscription-repository.port';
import {
  NewWebhookSubscription,
  UpdateWebhookSubscriptionInput,
  WebhookSubscriptionQuery,
  WebhookSubscriptionRecord,
} from '../webhook.types';
import { WebhookSubscriptionNotFoundError } from '../webhook.errors';

/** No DB, no BullMQ — plain in-memory fake for use-case specs. */
export class InMemoryWebhookSubscriptionRepository implements WebhookSubscriptionRepositoryPort {
  private readonly rows = new Map<string, WebhookSubscriptionRecord>();

  async create(input: NewWebhookSubscription): Promise<WebhookSubscriptionRecord> {
    const now = new Date();
    const record: WebhookSubscriptionRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      url: input.url,
      secret: input.secret,
      eventTypes: input.eventTypes,
      status: 'ACTIVE',
      description: input.description ?? null,
      consecutiveFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<WebhookSubscriptionRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async findActiveByEventType(eventType: string): Promise<WebhookSubscriptionRecord[]> {
    return [...this.rows.values()].filter(
      row => row.status === 'ACTIVE' && row.eventTypes.includes(eventType),
    );
  }

  async list(query: WebhookSubscriptionQuery): Promise<PageResult<WebhookSubscriptionRecord>> {
    const items = [...this.rows.values()].filter(
      row =>
        (!query.tenantId || row.tenantId === query.tenantId) &&
        (!query.status || row.status === query.status),
    );
    const start = (query.page - 1) * query.pageSize;
    const pageItems = items.slice(start, start + query.pageSize);
    return {
      items: pageItems,
      page: query.page,
      pageSize: query.pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / query.pageSize),
    };
  }

  async update(
    id: string,
    input: UpdateWebhookSubscriptionInput,
  ): Promise<WebhookSubscriptionRecord> {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new WebhookSubscriptionNotFoundError(id);
    }
    const updated: WebhookSubscriptionRecord = {
      ...existing,
      ...input,
      description: input.description !== undefined ? input.description : existing.description,
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async recordDeliveryOutcome(
    id: string,
    outcome: { success: boolean },
  ): Promise<WebhookSubscriptionRecord> {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new WebhookSubscriptionNotFoundError(id);
    }
    const updated: WebhookSubscriptionRecord = {
      ...existing,
      consecutiveFailures: outcome.success ? 0 : existing.consecutiveFailures + 1,
      lastSuccessAt: outcome.success ? new Date() : existing.lastSuccessAt,
      lastFailureAt: outcome.success ? existing.lastFailureAt : new Date(),
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }
}
