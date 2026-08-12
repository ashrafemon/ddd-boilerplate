import { Global, Module } from '@nestjs/common';
import { PrismaNumberingService } from './prisma-numbering.service';
import { NUMBERING } from './ports/numbering.port';

/**
 * Numbering sub-system — sequence-backed document numbering through the
 * TransactionHost so next numbers participate in the caller transaction.
 * Global so business modules can inject the NUMBERING port token anywhere.
 */
@Global()
@Module({
  providers: [PrismaNumberingService, { provide: NUMBERING, useExisting: PrismaNumberingService }],
  exports: [NUMBERING],
})
export class NumberingModule {}
