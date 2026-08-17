import { Global, Module } from '@nestjs/common';
import { PrismaNumberingService } from './prisma-numbering.service';
import { NumberingPort } from './ports/numbering.port';

/**
 * Numbering sub-system — sequence-backed document numbering through the
 * TransactionHost so next numbers participate in the caller transaction.
 * Global so business modules can inject the NumberingPort port anywhere.
 */
@Global()
@Module({
  providers: [
    PrismaNumberingService,
    { provide: NumberingPort, useExisting: PrismaNumberingService },
  ],
  exports: [NumberingPort],
})
export class NumberingModule {}
