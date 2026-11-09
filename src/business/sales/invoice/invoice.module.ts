import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { InvoiceForReportsFacade } from './application/facades/invoice-for-reports.facade';
import { RecurringOccurrenceRequestedRabbitMQListener } from './integrations/consumes/listeners/recurring-occurrence-requested.listener';
import { InvoicePublisherPort } from './application/publishes/publishers/invoice.publisher-port';
import { SharedOutboxAdapter } from '@platform/platform-common/outbox/adapters/shared-outbox.adapter';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { InvoiceQuery } from './application/queries/invoice.query';
import { NumberingPort } from './application/outbound-ports/numbering.port';
import { CreateInvoiceUseCase } from './application/use-cases/create-invoice.usecase';
import { GenerateRecurringInvoiceUseCase } from './application/use-cases/generate-recurring-invoice.usecase';
import { GetInvoiceUseCase } from './application/use-cases/get-invoice.usecase';
import { ListInvoicesUseCase } from './application/use-cases/list-invoices.usecase';
import { PostInvoiceUseCase } from './application/use-cases/post-invoice.usecase';
import { InvoiceCommandRepository } from './domain/repositories/invoice-command.repository';
import { PrismaInvoiceCommandRepository } from './infrastructure/persistence/prisma/prisma-invoice-command.repository';
import { PrismaInvoiceQueryRepository } from './infrastructure/persistence/prisma/prisma-invoice-query.repository';
import { NumberingAdapter } from './infrastructure/adapters/platform/numbering.adapter';
import { InvoiceController } from './presentation/http/invoice.controller';
import { InvoiceForReportsPort } from './public/ports/invoice-for-reports.port';

/**
 * Sales Invoice aggregate.
 *
 * Manual path: create/post through command use cases (aggregate + factory +
 * outbox). Recurring path: Recurring writes RecurringOccurrenceRequested to
 * the outbox; this module listens on RabbitMQ and generates via
 * GenerateRecurringInvoiceUseCase, completing the claimed execution.
 *
 * Command usecases now read company configuration from the global CLS
 * `RequestContext` (stamped by middleware) instead of injecting
 * `CompanyConfigPort` directly (Rule 8).
 */
@Module({
  imports: [PlatformModule],
  controllers: [InvoiceController],
  providers: [
    CreateInvoiceUseCase,
    PostInvoiceUseCase,
    GetInvoiceUseCase,
    ListInvoicesUseCase,
    GenerateRecurringInvoiceUseCase,
    RecurringOccurrenceRequestedRabbitMQListener,
    InvoiceForReportsFacade,
    { provide: InvoiceForReportsPort, useExisting: InvoiceForReportsFacade },
    { provide: InvoiceCommandRepository, useClass: PrismaInvoiceCommandRepository },
    { provide: InvoiceQuery, useClass: PrismaInvoiceQueryRepository },
    {
      provide: InvoicePublisherPort,
      useFactory: (outboxWriter: OutboxWriterPort) =>
        new SharedOutboxAdapter(outboxWriter, 'Invoice'),
      inject: [OutboxWriterPort],
    },
    { provide: NumberingPort, useClass: NumberingAdapter },
  ],
  exports: [InvoiceForReportsPort],
})
export class InvoiceModule {}
