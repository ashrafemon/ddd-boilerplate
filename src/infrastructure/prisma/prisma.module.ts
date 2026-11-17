import { Module } from '@nestjs/common';
import { PrismaReadService } from './prisma-read.service';
import { PrismaWriteService } from './prisma-write.service';

/**
 * Database module providing the write/read Prisma clients plus the
 * persistence adapters for every outbound port (unit of work, aggregates,
 * outbox). Business code never injects these directly — it depends on the
 * port tokens exported here.
 */

@Module({
  providers: [PrismaWriteService, PrismaReadService],
  exports: [PrismaWriteService, PrismaReadService],
})
export class PrismaModule {}
