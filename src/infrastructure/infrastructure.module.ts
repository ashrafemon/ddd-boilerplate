import { Global, Module } from '@nestjs/common';
import { NestjsClsModule } from './context/nestcls/nestcls.module';
import { PrismaModule } from './database/prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule, NestjsClsModule],
  exports: [PrismaModule, NestjsClsModule],
})
export class InfrastructureModule {}
