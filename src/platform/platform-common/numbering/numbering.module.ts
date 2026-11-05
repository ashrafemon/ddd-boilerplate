import { Module } from '@nestjs/common';
import { ContextModule } from '@platform/context/context.module';
import { PrismaNumberingRepository } from './repositories/numbering.repository';
import { NumberingPort } from './ports/numbering.port';

@Module({
  imports: [ContextModule],
  providers: [
    PrismaNumberingRepository,
    { provide: NumberingPort, useExisting: PrismaNumberingRepository },
  ],
  exports: [NumberingPort],
})
export class NumberingModule {}
