import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaModule } from '../database/prisma/prisma.module';
import { PrismaWriteService } from '../database/prisma/prisma-write.service';
import { RequestContextPort } from '../../shared-kernel/ports/context/request-context.port';
import { ClsRequestContextService } from './cls-request-context.service';

/**
 * Infrastructure context module — package initializer.
 *
 * Initializes the nestjs-cls package (CLS store + transactional plugin) and
 * provides the CLS-backed request context implementation of the platform
 * `RequestContextPort`. The request context middleware lives in the platform
 * context module.
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          imports: [PrismaModule],
          adapter: new TransactionalAdapterPrisma({
            prismaInjectionToken: PrismaWriteService,
            sqlFlavor: 'postgresql',
          }),
        }),
      ],
    }),
    PrismaModule,
  ],
  providers: [
    { provide: RequestContextPort, useClass: ClsRequestContextService },
    ClsRequestContextService,
  ],
  exports: [RequestContextPort, ClsRequestContextService],
})
export class ContextModule {}
