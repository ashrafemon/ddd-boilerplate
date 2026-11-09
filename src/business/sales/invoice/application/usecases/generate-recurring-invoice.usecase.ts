import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RecurringExecutionPort } from '@platform/platform-common/recurring/ports/recurring-execution.port';
import { RecurringOccurrenceRequestedPayload } from '../../domain/types/recurring-occurrence.types';
import { CreateInvoiceUseCase } from './create-invoice.usecase';
import { GetInvoiceUseCase } from './get-invoice.usecase';
import { PostInvoiceUseCase } from './post-invoice.usecase';
import { InvoiceRecurringLineService } from '../../domain/services/invoice-recurring-line.service';

@Injectable()
export class GenerateRecurringInvoiceUseCase {
  private readonly logger = new Logger(GenerateRecurringInvoiceUseCase.name);

  constructor(
    private readonly createInvoice: CreateInvoiceUseCase,
    private readonly getInvoice: GetInvoiceUseCase,
    private readonly postInvoice: PostInvoiceUseCase,
    private readonly recurringExecution: RecurringExecutionPort,
    private readonly loggerPort: LoggerPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(command: RecurringOccurrenceRequestedPayload): Promise<void> {
    await this.requestContext.run({ tenantId: command.tenantId }, () => this.run(command));
  }

  private async run(command: RecurringOccurrenceRequestedPayload): Promise<void> {
    if (command.targetEntityType && command.targetEntityType !== 'Invoice') {
      return;
    }
    if (!command.executionId) {
      throw new ConflictException('RecurringOccurrenceRequested.executionId is required');
    }
    if (!command.partyId) {
      throw new ConflictException('Recurring Invoice occurrence requires a customer partyId');
    }

    const execution = await this.recurringExecution.findById(command.executionId);
    if (!execution) {
      this.loggerPort.warn(
        `Skipping RecurringOccurrenceRequested: execution ${command.executionId} not found`,
      );
      return;
    }
    if (execution.status !== 'IN_PROGRESS') {
      this.loggerPort.info(
        `Skipping RecurringOccurrenceRequested for execution ${command.executionId} (status ${execution.status})`,
      );
      return;
    }

    const startedAt = Date.now();
    try {
      const lines = InvoiceRecurringLineService.validateAndMap(command.lines);
      const invoiceId = await this.createInvoice.execute({
        customerId: command.partyId,
        currency: command.currency,
        lines,
      });
      const snapshot = await this.getInvoice.execute(invoiceId.toString());
      if (!snapshot) {
        throw new ConflictException(
          `Generated invoice ${invoiceId.toString()} could not be read back`,
        );
      }
      await this.recurringExecution.complete(command.executionId, {
        generatedDocumentId: invoiceId.toString(),
        generatedSnapshot: snapshot as unknown as Record<string, unknown>,
        executionTimeMs: Date.now() - startedAt,
      });
      if (command.autoPost) {
        try {
          await this.postInvoice.execute(invoiceId.toString());
        } catch (postErr) {
          this.loggerPort.error(
            `autoPost failed for Invoice ${invoiceId.toString()}: ${(postErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      const message = FailureMessage.of(err);
      await this.recurringExecution.fail(command.executionId, message);
      this.loggerPort.error(
        `Recurring invoice generation failed for execution ${command.executionId}: ${message}`,
      );
    }
  }
}
