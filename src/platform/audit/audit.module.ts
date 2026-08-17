import { Global, Module } from '@nestjs/common';
import { PrismaAuditService } from './prisma-audit.service';
import { AuditPort } from './ports/audit.port';

/**
 * Audit sub-system — records governance/audit entries atomically with the
 * business change. Global so business modules can inject the AuditPort port
 * token anywhere.
 */
@Global()
@Module({
  providers: [PrismaAuditService, { provide: AuditPort, useExisting: PrismaAuditService }],
  exports: [AuditPort],
})
export class AuditModule {}
