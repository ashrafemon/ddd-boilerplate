import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { PrismaMasterAdapter } from 'src/infrastructure/database/prisma/prisma.master.adapter';
import { PrismaModule } from 'src/infrastructure/database/prisma/prisma.module';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          imports: [PrismaModule],
          adapter: new TransactionalAdapterPrisma({
            prismaInjectionToken: PrismaMasterAdapter,
            sqlFlavor: 'postgresql',
          }),
        }),
      ],
    }),
  ],
})
export class NestjsClsModule {}
