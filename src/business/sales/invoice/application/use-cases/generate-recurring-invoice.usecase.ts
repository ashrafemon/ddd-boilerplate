import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { FailureMessage } from '@common/application/utils/failure-message';
import { LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RecurringExecutionPort } from '@platform/platform-common/recurring/ports/recurring-execution.port';
import { RecurringOccurrenceRequestedPayload } from '../../domain/types/recurring-occurrence.types';
import { RecurringInvoiceGenerationPort } from '@business/sales/invoice/public/ports/recurring-invoice-generation.port';

/**
 * Recurring invoice execution trigger. Delegates all business orchestration
 * (create → snapshot → post) to RecurringInvoiceGenerationFacade. This use
 * case owns only the recurring-execution lifecycle (find/complete/fail).
 */
@Injectable()
export class GenerateRecurringInvoiceUseCase {
  private readonly logger = new Logger(GenerateRecurringInvoiceUseCase.name);

  constructor(
    private readonly recurringInvoiceGeneration: RecurringInvoiceGenerationPort,
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
      const normalizedLines = command.lines.map(
        (l: { productId: string; quantity: number; unitPrice: number }) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        }),
      );
      const result = await this.recurringInvoiceGeneration.generateRecurringInvoice(
        command.partyId,
        command.currency,
        normalizedLines,
        command.autoPost,
      );
      await this.recurringExecution.complete(command.executionId, {
        generatedDocumentId: result!.invoiceId,
        generatedSnapshot: result!.snapshot,
        executionTimeMs: Date.now() - startedAt,
      });
    } catch (err) {
      const message = FailureMessage.of(err);
      await this.recurringExecution.fail(command.executionId, message);
      this.loggerPort.error(
        `Recurring invoice generation failed for execution ${command.executionId}: ${message}`,
      );
    }
  }
}
