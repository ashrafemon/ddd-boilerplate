import { Global, Module } from '@nestjs/common';
import { PrismaNumberingService } from './prisma-numbering.service';
import { NumberingPort } from './ports/numbering.port';

@Global()
@Module({
  providers: [
    PrismaNumberingService,
    { provide: NumberingPort, useExisting: PrismaNumberingService },
  ],
  exports: [NumberingPort],
})
export class NumberingModule {}
