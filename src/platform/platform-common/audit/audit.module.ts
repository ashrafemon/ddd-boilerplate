import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module';
import { AuditPort } from './ports/audit.port';
import { AuditAdapter } from './adapters/audit.adapter';
import { PrismaAuditLogRepository } from './repositories/prisma-audit-log.repository';
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
    RecordAuditEntryUseCase,
    AuditAdapter,
    { provide: AuditPort, useExisting: AuditAdapter },
  ],
  exports: [AuditPort],
})
export class AuditModule {}
