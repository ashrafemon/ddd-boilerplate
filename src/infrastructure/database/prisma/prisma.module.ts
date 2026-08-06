import { Module } from '@nestjs/common';
import { PrismaMasterAdapter } from './prisma.master.adapter';
import { PrismaSlaveAdapter } from './prisma.slave.adapter';

@Module({
  imports: [],
  providers: [PrismaMasterAdapter, PrismaSlaveAdapter],
  exports: [PrismaMasterAdapter, PrismaSlaveAdapter],
})
export class PrismaModule {}
