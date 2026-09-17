/* eslint-disable @typescript-eslint/require-await -- in-memory test double: the port is async, the storage is a Map */
import { randomUUID } from 'crypto';
import { PageResult } from '@shared-kernel/types/pagination';
import { WebhookDeliveryRepositoryPort } from '../ports/webhook-delivery-repository.port';
import { NewWebhookDelivery, WebhookDeliveryQuery, WebhookDeliveryRecord } from '../webhook.types';
import { WebhookDeliveryNotFoundError } from '../webhook.errors';

/** No DB, no BullMQ — plain in-memory fake for use-case specs. */
export class InMemoryWebhookDeliveryRepository implements WebhookDeliveryRepositoryPort {
  private readonly rows = new Map<string, WebhookDeliveryRecord>();

  async createMany(deliveries: NewWebhookDelivery[]): Promise<WebhookDeliveryRecord[]> {
    const created: WebhookDeliveryRecord[] = [];
    for (const delivery of deliveries) {
      const exists = [...this.rows.values()].some(
        row => row.subscriptionId === delivery.subscriptionId && row.eventId === delivery.eventId,
      );
      if (exists) {
        continue;
      }
      const now = new Date();
      const record: WebhookDeliveryRecord = {
        id: randomUUID(),
        tenantId: delivery.tenantId,
        subscriptionId: delivery.subscriptionId,
        eventId: delivery.eventId,
        eventType: delivery.eventType,
        payload: delivery.payload,
        status: 'PENDING',
        attemptCount: 0,
        nextAttemptAt: now,
        claimedAt: null,
        lastResponseCode: null,
        lastError: null,
        deliveredAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.rows.set(record.id, record);
      created.push(record);
    }
    return created;
  }

  async findById(id: string): Promise<WebhookDeliveryRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async list(query: WebhookDeliveryQuery): Promise<PageResult<WebhookDeliveryRecord>> {
    const items = [...this.rows.values()].filter(
      row =>
        (!query.subscriptionId || row.subscriptionId === query.subscriptionId) &&
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

  async claim(id: string): Promise<WebhookDeliveryRecord | null> {
    const existing = this.rows.get(id);
    if (!existing || existing.status !== 'PENDING') {
      return null;
    }
    const claimed: WebhookDeliveryRecord = {
      ...existing,
      status: 'DELIVERING',
      claimedAt: new Date(),
      updatedAt: new Date(),
    };
    this.rows.set(id, claimed);
    return claimed;
  }

  private mutate(
    id: string,
    fromStatus: WebhookDeliveryRecord['status'],
    patch: Partial<WebhookDeliveryRecord>,
  ): void {
    const existing = this.rows.get(id);
    if (!existing || existing.status !== fromStatus) {
      return;
    }
    this.rows.set(id, { ...existing, ...patch, updatedAt: new Date() });
  }

  async markDelivered(id: string, responseCode: number): Promise<void> {
    this.mutate(id, 'DELIVERING', {
      status: 'DELIVERED',
      deliveredAt: new Date(),
      lastResponseCode: responseCode,
      lastError: null,
    });
  }

  async markFailedForRetry(
    id: string,
    nextAttemptAt: Date,
    responseCode: number | null,
    error: string,
  ): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing || existing.status !== 'DELIVERING') {
      return;
    }
    this.mutate(id, 'DELIVERING', {
      status: 'PENDING',
      attemptCount: existing.attemptCount + 1,
      nextAttemptAt,
      claimedAt: null,
      lastResponseCode: responseCode,
      lastError: error,
    });
  }

  async markDeadLettered(id: string, responseCode: number | null, error: string): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing || (existing.status !== 'PENDING' && existing.status !== 'DELIVERING')) {
      return;
    }
    this.rows.set(id, {
      ...existing,
      status: 'DEAD_LETTER',
      lastResponseCode: responseCode,
      lastError: error,
      updatedAt: new Date(),
    });
  }

  async resetStuck(windowMs: number): Promise<string[]> {
    const cutoff = Date.now() - windowMs;
    const ids: string[] = [];
    for (const row of this.rows.values()) {
      if (row.status === 'DELIVERING' && (row.claimedAt?.getTime() ?? 0) < cutoff) {
        this.rows.set(row.id, {
          ...row,
          status: 'PENDING',
          claimedAt: null,
          updatedAt: new Date(),
        });
        ids.push(row.id);
      }
    }
    return ids;
  }

  async findStalePending(windowMs: number): Promise<string[]> {
    const cutoff = Date.now() - windowMs;
    return [...this.rows.values()]
      .filter(
        row =>
          row.status === 'PENDING' && row.claimedAt === null && row.createdAt.getTime() < cutoff,
      )
      .map(row => row.id);
  }

  async resetForRedelivery(id: string): Promise<WebhookDeliveryRecord> {
    const existing = this.rows.get(id);
    if (!existing || existing.status !== 'DEAD_LETTER') {
      throw new WebhookDeliveryNotFoundError(id);
    }
    const updated: WebhookDeliveryRecord = {
      ...existing,
      status: 'PENDING',
      nextAttemptAt: new Date(),
      claimedAt: null,
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }
}
