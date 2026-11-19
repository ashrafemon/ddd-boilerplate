import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { PrismaAuditLogRepository } from '../repositories/prisma-audit-log.repository';
import { AuditEntry, redactChanges } from '../types/audit.types';

/**
 * Use case: resolve an `AuditEntry` into a complete row and append it.
 *
 * Actor and scope default to the request context (CLS) so a caller never has to
 * thread tenant/company/actor through its own signature, and a system-initiated
 * change is labelled `system` rather than impersonating a user.
 */
@Injectable()
export class RecordAuditEntryUseCase {
  constructor(
    private readonly auditLogs: PrismaAuditLogRepository,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(entry: AuditEntry): Promise<void> {
    const context = this.requestContext.get();
    const actorId = entry.actorId ?? context?.userId;
    await this.auditLogs.append({
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: redactChanges(entry.changes),
      actorId,
      actorType: entry.actorType ?? (actorId ? 'user' : 'system'),
      tenantId: entry.tenantId ?? this.requestContext.getTenantId(),
      companyId: entry.companyId ?? this.requestContext.getCompanyId(),
      requestId: this.requestContext.getRequestId(),
      correlationId: this.requestContext.getCorrelationId(),
    });
  }
}
