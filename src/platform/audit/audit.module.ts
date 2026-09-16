import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module';
import { PrismaAuditRepository } from './repositories/audit.repository';
import { AuditPort } from './ports/audit.port';

@Module({
  imports: [ContextModule],
  providers: [PrismaAuditRepository, { provide: AuditPort, useExisting: PrismaAuditRepository }],
  exports: [AuditPort],
})
export class AuditModule {}
