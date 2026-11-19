import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { AuditLogRecord } from '../types/audit.types';

/** PostgreSQL adapter for `audit_logs`, inside the caller's transaction. */
@Injectable()
export class PrismaAuditLogRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async append(record: AuditLogRecord): Promise<void> {
    await this.txHost.tx.auditLog.create({
      data: {
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId,
        changes: (record.changes as object | undefined) ?? undefined,
        actorId: record.actorId,
        actorType: record.actorType,
        tenantId: record.tenantId,
        companyId: record.companyId,
        requestId: record.requestId,
        correlationId: record.correlationId,
      },
    });
  }
}
