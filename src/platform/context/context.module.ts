import { Module } from '@nestjs/common';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { PrismaReadService } from '@infrastructure/database/prisma/prisma-read.service';
import { ClsRequestContextService } from './adapters/cls-request-context.service';
import { RequestContextPort } from './ports/request-context.port';
import { PrismaReadPort } from './ports/prisma-read.port';

/**
 * Platform context module — session/context concerns for business code:
 * the request context (nestjs-cls) and the read-replica connection port
 * (PrismaReadPort bound to the infrastructure PrismaReadService).
 */
@Module({
  imports: [InfrastructureModule],
  providers: [
    ClsRequestContextService,
    { provide: RequestContextPort, useClass: ClsRequestContextService },
    { provide: PrismaReadPort, useExisting: PrismaReadService },
  ],
  exports: [RequestContextPort, PrismaReadPort],
})
export class ContextModule {}
