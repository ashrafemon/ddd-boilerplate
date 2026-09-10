import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform/platform.module';
import { InvoiceForReportsFacade } from './application/facades/invoice-for-reports.facade';
import { InvoiceEventEmitterListener } from './application/integrations/listeners/invoice.created.event-emitter.listener-event';
import { InvoiceKafkaListener } from './application/integrations/listeners/invoice.created.kafka.listener-event';
import { InvoiceRabbitMQListener } from './application/integrations/listeners/invoice.created.rabbitmq.listener-event';
import { RecurringOccurrenceRequestedRabbitMQListener } from './application/integrations/listeners/recurring-occurrence-requested.rabbitmq.listener-event';
import { InvoiceSqsListener } from './application/integrations/listeners/invoice.sqs.listener-event';
import { InvoiceIntegrationPort } from './application/integrations/publishes/invoice.integration-port';
import { InvoiceQuery } from './application/queries/invoice.query';
import { CompanyConfigPort } from './application/outbound-ports/company-config.port';
import { NumberingPort } from './application/outbound-ports/numbering.port';
import { CreateInvoiceUseCase } from './application/usecases/create-invoice.usecase';
import { GenerateRecurringInvoiceUseCase } from './application/usecases/generate-recurring-invoice.usecase';
import { GetInvoiceUseCase } from './application/usecases/get-invoice.usecase';
import { ListInvoicesUseCase } from './application/usecases/list-invoices.usecase';
import { PostInvoiceUseCase } from './application/usecases/post-invoice.usecase';
import { InvoiceCommandRepository } from './domain/repositories/invoice-command.repository';
import { CompanyConfigAdapter } from './infrastructure/adapters/platform/company-config.adapter';
import { NumberingAdapter } from './infrastructure/adapters/platform/numbering.adapter';
import { OutboxAdapter } from './infrastructure/adapters/platform/outbox.adapter';
import { PrismaInvoiceCommandRepository } from './infrastructure/persistence/prisma-invoice-command.repository';
import { PrismaInvoiceQueryRepository } from './infrastructure/persistence/prisma-invoice-query.repository';
import { InvoiceController } from './presentation/http/invoice.controller';
import { InvoiceForReportsPort } from './public';
import './domain/events/invoice.registry';

/**
 * Sales Invoice aggregate.
 *
 * Manual path: create/post through command use cases (aggregate + factory +
 * outbox). Recurring path: Recurring writes RecurringOccurrenceRequested to
 * the outbox; this module listens on RabbitMQ and generates via
 * GenerateRecurringInvoiceUseCase, completing the claimed execution.
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
    InvoiceEventEmitterListener,
    InvoiceRabbitMQListener,
    InvoiceKafkaListener,
    InvoiceSqsListener,
    RecurringOccurrenceRequestedRabbitMQListener,
    InvoiceForReportsFacade,
    { provide: InvoiceForReportsPort, useExisting: InvoiceForReportsFacade },
    { provide: InvoiceCommandRepository, useClass: PrismaInvoiceCommandRepository },
    { provide: InvoiceQuery, useClass: PrismaInvoiceQueryRepository },
    { provide: InvoiceIntegrationPort, useClass: OutboxAdapter },
    { provide: CompanyConfigPort, useClass: CompanyConfigAdapter },
    { provide: NumberingPort, useClass: NumberingAdapter },
  ],
  exports: [InvoiceForReportsPort],
})
export class InvoiceModule {}
