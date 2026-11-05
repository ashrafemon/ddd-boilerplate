import { Prisma } from '../../../generated/client';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PageResult } from '@shared-kernel/types/pagination';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { WebhookDeliveryRepositoryPort } from '../ports/webhook-delivery-repository.port';
import { NewWebhookDelivery, WebhookDeliveryQuery, WebhookDeliveryRecord } from '../webhook.types';
import { WebhookDeliveryNotFoundError } from '../webhook.errors';
import { WebhookMapper } from './webhook.mapper';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaWebhookDeliveryRepository implements WebhookDeliveryRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async createMany(deliveries: NewWebhookDelivery[]): Promise<WebhookDeliveryRecord[]> {
    const created: WebhookDeliveryRecord[] = [];
    for (const delivery of deliveries) {
      try {
        const row = await this.txHost.tx.webhookDelivery.create({
          data: {
            tenantId: delivery.tenantId,
            subscriptionId: delivery.subscriptionId,
            eventId: delivery.eventId,
            eventType: delivery.eventType,
            payload: PrismaJson.toInputRequired(delivery.payload),
          },
        });
        created.push(WebhookMapper.toDeliveryRecord(row));
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === UNIQUE_CONSTRAINT_VIOLATION
        ) {
          // Already dispatched for this (subscriptionId, eventId) — a
          // re-delivered outbox event must not double-create a delivery row.
          continue;
        }
        throw err;
      }
    }
    return created;
  }

  async findById(id: string): Promise<WebhookDeliveryRecord | null> {
    const row = await this.txHost.tx.webhookDelivery.findUnique({ where: { id } });
    return row ? WebhookMapper.toDeliveryRecord(row) : null;
  }

  async list(query: WebhookDeliveryQuery): Promise<PageResult<WebhookDeliveryRecord>> {
    const where = {
      ...(query.subscriptionId ? { subscriptionId: query.subscriptionId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.txHost.tx.webhookDelivery.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.txHost.tx.webhookDelivery.count({ where }),
    ]);
    return {
      items: rows.map(row => WebhookMapper.toDeliveryRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async claim(id: string): Promise<WebhookDeliveryRecord | null> {
    const result = await this.txHost.tx.webhookDelivery.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'DELIVERING', claimedAt: new Date() },
    });
    if (result.count === 0) {
      return null;
    }
    const row = await this.txHost.tx.webhookDelivery.findUnique({ where: { id } });
    return row ? WebhookMapper.toDeliveryRecord(row) : null;
  }

  async markDelivered(id: string, responseCode: number): Promise<void> {
    await this.txHost.tx.webhookDelivery.updateMany({
      where: { id, status: 'DELIVERING' },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        lastResponseCode: responseCode,
        lastError: null,
      },
    });
  }

  async markFailedForRetry(
    id: string,
    nextAttemptAt: Date,
    responseCode: number | null,
    error: string,
  ): Promise<void> {
    await this.txHost.tx.webhookDelivery.updateMany({
      where: { id, status: 'DELIVERING' },
      data: {
        status: 'PENDING',
        attemptCount: { increment: 1 },
        nextAttemptAt,
        claimedAt: null,
        lastResponseCode: responseCode,
        lastError: error,
      },
    });
  }

  async markDeadLettered(id: string, responseCode: number | null, error: string): Promise<void> {
    // PENDING covers the normal post-attempt state (markFailedForRetry already
    // ran); DELIVERING covers a worker that died before reaching that call.
    await this.txHost.tx.webhookDelivery.updateMany({
      where: { id, status: { in: ['PENDING', 'DELIVERING'] } },
      data: {
        status: 'DEAD_LETTER',
        lastResponseCode: responseCode,
        lastError: error,
      },
    });
  }

  async resetStuck(windowMs: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - windowMs);
    const stuck = await this.txHost.tx.webhookDelivery.findMany({
      where: { status: 'DELIVERING', claimedAt: { lt: cutoff } },
      select: { id: true },
    });
    if (stuck.length === 0) {
      return [];
    }
    const ids = stuck.map(row => row.id);
    await this.txHost.tx.webhookDelivery.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PENDING', claimedAt: null },
    });
    return ids;
  }

  async findStalePending(windowMs: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - windowMs);
    const stale = await this.txHost.tx.webhookDelivery.findMany({
      where: { status: 'PENDING', claimedAt: null, createdAt: { lt: cutoff } },
      select: { id: true },
    });
    return stale.map(row => row.id);
  }

  async resetForRedelivery(id: string): Promise<WebhookDeliveryRecord> {
    const result = await this.txHost.tx.webhookDelivery.updateMany({
      where: { id, status: 'DEAD_LETTER' },
      data: { status: 'PENDING', nextAttemptAt: new Date(), claimedAt: null },
    });
    if (result.count === 0) {
      throw new WebhookDeliveryNotFoundError(id);
    }
    const row = await this.txHost.tx.webhookDelivery.findUniqueOrThrow({ where: { id } });
    return WebhookMapper.toDeliveryRecord(row);
  }
}
