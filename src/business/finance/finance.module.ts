import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { FinanceController } from './presentation/http/finance.controller';
import { PostJournalEntryUseCase } from './application/use-cases/post-journal-entry.usecase';
import { CreateVendorBillUseCase } from './application/use-cases/create-vendor-bill.usecase';
import { SettlePayableUseCase } from './application/use-cases/settle-payable.usecase';
import {
  JournalEntryRepository,
  VendorBillRepository,
  PaymentRepository,
  PayableOpenItemRepository,
} from './domain/repositories/finance.repository';
import { FinanceQuery } from './application/queries/finance.query';
import { FinancePublisherPort } from './application/publishes/publishers/finance.publisher-port';
import { SharedOutboxAdapter } from '@platform/platform-common/outbox/adapters/shared-outbox.adapter';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { PrismaJournalEntryRepository } from './infrastructure/persistence/prisma/prisma-finance-command.repository';
import { PrismaFinanceQueryRepository } from './infrastructure/persistence/prisma/prisma-finance-query.repository';

@Module({
  imports: [PlatformModule],
  controllers: [FinanceController],
  providers: [
    PostJournalEntryUseCase,
    CreateVendorBillUseCase,
    SettlePayableUseCase,
    { provide: JournalEntryRepository, useClass: PrismaJournalEntryRepository },
    { provide: VendorBillRepository, useClass: PrismaJournalEntryRepository },
    { provide: PaymentRepository, useClass: PrismaJournalEntryRepository },
    { provide: PayableOpenItemRepository, useClass: PrismaJournalEntryRepository },
    { provide: FinanceQuery, useClass: PrismaFinanceQueryRepository },
    {
      provide: FinancePublisherPort,
      useFactory: (outboxWriter: OutboxWriterPort) =>
        new SharedOutboxAdapter(outboxWriter, 'Finance'),
      inject: [OutboxWriterPort],
    },
  ],
  exports: [],
})
export class FinanceModule {}
