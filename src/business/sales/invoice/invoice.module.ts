import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { InvoiceForReportsFacade } from './application/facades/invoice-for-reports.facade';
import { RecurringOccurrenceRequestedRabbitMQListener } from './application/integrations/listens/recurring-occurrence-requested.rabbitmq.listener-event';
import { InvoicePublisherPort } from './application/integrations/publishes/invoice.publisher-port';
import { InvoiceQuery } from './application/queries/invoice.query';
import { NumberingPort } from './application/outbound-ports/numbering.port';
import { CreateInvoiceUseCase } from './application/usecases/create-invoice.usecase';
import { GenerateRecurringInvoiceUseCase } from './application/usecases/generate-recurring-invoice.usecase';
import { GetInvoiceUseCase } from './application/usecases/get-invoice.usecase';
import { ListInvoicesUseCase } from './application/usecases/list-invoices.usecase';
import { PostInvoiceUseCase } from './application/usecases/post-invoice.usecase';
import { InvoiceCommandRepository } from './domain/repositories/invoice-command.repository';
import { PrismaInvoiceCommandRepository } from './infrastructure/persistence/prisma/prisma-invoice-command.repository';
import { PrismaInvoiceQueryRepository } from './infrastructure/persistence/prisma/prisma-invoice-query.repository';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
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
    { provide: InvoicePublisherPort, useClass: OutboxAdapter },
    { provide: NumberingPort, useClass: NumberingAdapter },
  ],
  exports: [InvoiceForReportsPort],
})
export class InvoiceModule {}
