import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module';
import { AuditPort } from './inbound/ports/audit.port';
import { AuditAdapter } from './inbound/adapters/audit.adapter';
import { AuditLogRepositoryPort } from './outbound/ports/audit-log.repository.port';
import { PrismaAuditLogRepository } from './outbound/adapters/prisma-audit-log.repository';
import { RecordAuditEntryUseCase } from './use-cases/record-audit-entry.usecase';

/**
 * Platform Audit module — append-only change trail.
 *
 * NOT global. Callers inject `AuditPort`; rows commit inside the caller's
 * transaction and inherit actor/tenant scope from the request context.
 */
@Module({
  imports: [ContextModule],
  providers: [
    PrismaAuditLogRepository,
    { provide: AuditLogRepositoryPort, useExisting: PrismaAuditLogRepository },
    RecordAuditEntryUseCase,
    AuditAdapter,
    { provide: AuditPort, useExisting: AuditAdapter },
  ],
  exports: [AuditPort],
})
export class AuditModule {}
