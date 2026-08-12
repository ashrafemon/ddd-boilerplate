import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ClsService } from 'nestjs-cls';
import {
  CORRELATION_ID_KEY,
  REQUEST_ID_KEY,
} from '@shared-kernel/interceptors/request-id.interceptor';
import { AuditEntry, AuditPort } from './ports/audit.port';

/**
 * Prisma-backed audit trail. All DB access goes through the TransactionHost
 * so audit rows commit atomically with the business change. Enriches entries
 * with the request/correlation id from CLS for traceability.
 */
@Injectable()
export class PrismaAuditService implements AuditPort {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly cls: ClsService,
  ) {}

  public async record(entry: AuditEntry): Promise<void> {
    const requestId = this.cls.get<string>(REQUEST_ID_KEY);
    const correlationId = this.cls.get<string>(CORRELATION_ID_KEY);

    await this.txHost.tx.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: (entry.changes as object) ?? undefined,
        actorType: entry.actorType,
        actorId: entry.actorId,
        tenantId: entry.tenantId,
        organizationId: entry.organizationId,
        requestId,
        correlationId,
      },
    });
  }
}
