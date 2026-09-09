import { Global, Module } from '@nestjs/common';
import { PrismaAuditService } from './prisma-audit.service';
import { AuditPort } from './ports/audit.port';

@Global()
@Module({
  providers: [PrismaAuditService, { provide: AuditPort, useExisting: PrismaAuditService }],
  exports: [AuditPort],
})
export class AuditModule {}
