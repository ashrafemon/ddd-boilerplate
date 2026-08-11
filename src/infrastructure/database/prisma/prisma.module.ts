import { Global, Module } from '@nestjs/common';
import { PrismaReadService } from './prisma-read.service';
import { PrismaWriteService } from './prisma-write.service';

/**
 * Global database module providing the write and read Prisma clients.
 * Business code never injects these directly; only infrastructure adapters do.
 */
@Global()
@Module({
  providers: [PrismaWriteService, PrismaReadService],
  exports: [PrismaWriteService, PrismaReadService],
})
export class PrismaModule {}
