import { Module } from '@nestjs/common';
import { PrismaAuditService } from './prisma-audit.service';
import { AuditPort } from './ports/audit.port';

@Module({
  providers: [PrismaAuditService, { provide: AuditPort, useExisting: PrismaAuditService }],
  exports: [AuditPort],
})
export class AuditModule {}
