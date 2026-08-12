import { Global, Module } from '@nestjs/common';
import { PrismaAuditService } from './prisma-audit.service';
import { AUDIT } from './ports/audit.port';

/**
 * Audit sub-system — records governance/audit entries atomically with the
 * business change. Global so business modules can inject the AUDIT port
 * token anywhere.
 */
@Global()
@Module({
  providers: [PrismaAuditService, { provide: AUDIT, useExisting: PrismaAuditService }],
  exports: [AUDIT],
})
export class AuditModule {}
