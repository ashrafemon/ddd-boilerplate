import { Module } from '@nestjs/common';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { PrismaReadService } from '@infrastructure/database/prisma/prisma-read.service';
import { PrismaReadPort } from './ports/prisma-read.port';

/**
 * Platform database module — turns the infrastructure read client into the
 * `PrismaReadPort` service that business query repositories depend on.
 */
@Module({
  imports: [InfrastructureModule],
  providers: [{ provide: PrismaReadPort, useExisting: PrismaReadService }],
  exports: [PrismaReadPort],
})
export class DatabaseModule {}
