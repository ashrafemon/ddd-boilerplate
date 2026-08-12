import { PrismaWriteService } from '@infrastructure/database/prisma/prisma-write.service';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Global, Module } from '@nestjs/common';
import { MODULE_PORT_RESOLVER } from '@business/shared-business/ports/module-port-resolver.port';
import { RequestContextPort } from '@shared-kernel/ports/context/request-context.port';
import { ClsModule } from 'nestjs-cls';
import { ClsRequestContextService } from './cls-request-context.service';
import { NestModulePortResolver } from './nest-module-port-resolver';

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
  ],
  providers: [
    { provide: RequestContextPort, useClass: ClsRequestContextService },
    NestModulePortResolver,
    { provide: MODULE_PORT_RESOLVER, useExisting: NestModulePortResolver },
  ],
  exports: [RequestContextPort, MODULE_PORT_RESOLVER],
})
export class ContextModule {}
