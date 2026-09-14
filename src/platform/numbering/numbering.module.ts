import { Module } from '@nestjs/common';
import { PrismaNumberingRepository } from './repositories/numbering.repository';
import { NumberingPort } from './ports/numbering.port';

@Module({
  providers: [
    PrismaNumberingRepository,
    { provide: NumberingPort, useExisting: PrismaNumberingRepository },
  ],
  exports: [NumberingPort],
})
export class NumberingModule {}
