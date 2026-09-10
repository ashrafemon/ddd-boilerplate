import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { AuditEntry, AuditPort } from './ports/audit.port';

/**
 * Prisma-backed audit trail. All DB access goes through the TransactionHost
 * so audit rows commit atomically with the business change. Request/correlation
 * ids and tenant/organization scope are filled from `RequestContextPort` when
 * the caller does not provide them.
 */
@Injectable()
export class PrismaAuditService implements AuditPort {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly requestContext: RequestContextPort,
  ) {}

  public async record(entry: AuditEntry): Promise<void> {
    await this.txHost.tx.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: (entry.changes as object) ?? undefined,
        actorType: entry.actorType,
        actorId: entry.actorId,
        tenantId: entry.tenantId ?? this.requestContext.getTenantId(),
        organizationId: entry.organizationId ?? this.requestContext.getOrganizationId(),
        requestId: this.requestContext.getRequestId(),
        correlationId: this.requestContext.getCorrelationId(),
      },
    });
  }
}
