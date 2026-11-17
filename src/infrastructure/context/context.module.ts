import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';

/**
 * Infrastructure context module — only CLS and transactional plugin setup.
 *
 * Initializes the nestjs-cls package (CLS store + transactional plugin).
 * The platform layer provides the RequestContextPort
 * implementations.
 */

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
})
export class ContextModule {}
