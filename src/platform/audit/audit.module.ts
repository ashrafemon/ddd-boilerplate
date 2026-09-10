import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module';
import { PrismaAuditService } from './prisma-audit.service';
import { AuditPort } from './ports/audit.port';

@Module({
  imports: [ContextModule],
  providers: [PrismaAuditService, { provide: AuditPort, useExisting: PrismaAuditService }],
  exports: [AuditPort],
})
export class AuditModule {}
