import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '@prisma/client';
import { OutboxEventInput, OutboxPort } from '../../shared-kernel/ports/outbox/outbox.port';

type PrismaTxClient = Prisma.TransactionClient;

/**
 * Writes outbox records through the CLS transaction client so the outbox
 * append is atomic with the aggregate persistence.
 */
@Injectable()
export class PrismaOutboxRepository implements OutboxPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  public async append(event: OutboxEventInput): Promise<void> {
    const tx = this.txHost.tx as PrismaTxClient;
    await tx.outboxEvent.create({ data: this.toRecord(event) });
  }

  public async appendMany(events: OutboxEventInput[]): Promise<void> {
    if (events.length === 0) return;
    const tx = this.txHost.tx as PrismaTxClient;
    await tx.outboxEvent.createMany({ data: events.map((event) => this.toRecord(event)) });
  }

  private toRecord(event: OutboxEventInput): Prisma.OutboxEventUncheckedCreateInput {
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      tenantId: event.tenantId,
      organizationId: event.organizationId,
      correlationId: event.correlationId,
      payload: event.payload as Prisma.InputJsonValue,
      availableAt: event.availableAt ?? new Date(),
    };
  }
}
