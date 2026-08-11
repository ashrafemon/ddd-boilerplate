import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OutboxRecord, OutboxReadStorePort } from '../../shared-kernel/ports/outbox/outbox-read-store.port';
import { PrismaReadService } from '../../infrastructure/database/prisma/prisma-read.service';
import { PrismaWriteService } from '../../infrastructure/database/prisma/prisma-write.service';

/**
 * Outbox read store backed by Prisma. Claiming is atomic: a batch of due
 * events is locked with a `lockedAt` timestamp so parallel dispatchers do not
 * process the same event twice.
 */
@Injectable()
export class PrismaOutboxReadStore implements OutboxReadStorePort {
  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly prismaWrite: PrismaWriteService,
  ) {}

  public async claimNextBatch(batchSize: number, now: Date): Promise<OutboxRecord[]> {
    const where: Prisma.OutboxEventWhereInput = {
      status: { in: ['PENDING', 'FAILED'] },
      availableAt: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lte: new Date(now.getTime() - 60_000) } }],
    };

    const batch = await this.prismaRead.outboxEvent.findMany({
      where,
      orderBy: [{ availableAt: 'asc' }],
      take: batchSize,
      select: {
        id: true,
        eventId: true,
        eventType: true,
        aggregateType: true,
        aggregateId: true,
        tenantId: true,
        organizationId: true,
        correlationId: true,
        payload: true,
        attemptCount: true,
        lastError: true,
      },
    });

    if (batch.length === 0) return [];

    await this.prismaWrite.outboxEvent.updateMany({
      where: { id: { in: batch.map((item) => item.id) } },
      data: { status: 'PROCESSING', lockedAt: now },
    });

    return batch.map((item) => this.toRecord(item));
  }

  public async markDelivered(id: string, processedAt: Date): Promise<void> {
    await this.prismaWrite.outboxEvent.update({
      where: { id },
      data: { status: 'DELIVERED', processedAt, lockedAt: null },
    });
  }

  public async markFailed(id: string, error: string, maxAttempts: number): Promise<'RETRY' | 'DEAD_LETTER'> {
    const current = await this.prismaRead.outboxEvent.findUnique({ where: { id } });
    const nextAttemptCount = (current?.attemptCount ?? 0) + 1;
    const status = nextAttemptCount >= maxAttempts ? 'DEAD_LETTER' : 'FAILED';
    const nextAvailableAt = new Date(Date.now() + 5_000 * Math.pow(2, Math.min(nextAttemptCount, 5)));

    await this.prismaWrite.outboxEvent.update({
      where: { id },
      data: {
        status,
        attemptCount: nextAttemptCount,
        lastError: error.slice(0, 2000),
        lockedAt: null,
        availableAt: status === 'DEAD_LETTER' ? new Date() : nextAvailableAt,
      },
    });

    return status === 'DEAD_LETTER' ? 'DEAD_LETTER' : 'RETRY';
  }

  public async countPending(): Promise<number> {
    return this.prismaRead.outboxEvent.count({ where: { status: { in: ['PENDING', 'FAILED'] } } });
  }

  private toRecord(item: {
    id: string;
    eventId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    tenantId: string;
    organizationId: string | null;
    correlationId: string | null;
    payload: Prisma.JsonValue;
    attemptCount: number;
    lastError: string | null;
  }): OutboxRecord {
    return {
      id: item.id,
      eventId: item.eventId,
      eventType: item.eventType,
      aggregateType: item.aggregateType,
      aggregateId: item.aggregateId,
      tenantId: item.tenantId,
      organizationId: item.organizationId,
      correlationId: item.correlationId,
      payload: (item.payload as Record<string, unknown>) ?? {},
      attemptCount: item.attemptCount,
      lastError: item.lastError,
    };
  }
}
