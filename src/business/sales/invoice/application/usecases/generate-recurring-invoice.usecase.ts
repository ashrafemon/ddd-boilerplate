import { ConflictException, Injectable } from '@nestjs/common';
import { LoggerPort } from '@platform/observability/ports/logger.port';
import { RecurringExecutionPort } from '@platform/recurring/ports/recurring-execution.port';
import { asInvoiceLines } from '../integrations/recurring-invoice.mapper';
import { RecurringOccurrenceRequestedPayload } from '../integrations/recurring-occurrence.types';
import { CreateInvoiceUseCase } from './create-invoice.usecase';
import { GetInvoiceUseCase } from './get-invoice.usecase';
import { PostInvoiceUseCase } from './post-invoice.usecase';

/**
 * Creates an invoice from a RecurringOccurrenceRequested integration event
 * (outbox → RabbitMQ → listener). Completes (or fails) the claimed Recurring
 * execution so the platform bookkeeping stays consistent.
 */
@Injectable()
export class GenerateRecurringInvoiceUseCase {
  constructor(
    private readonly createInvoice: CreateInvoiceUseCase,
    private readonly getInvoice: GetInvoiceUseCase,
    private readonly postInvoice: PostInvoiceUseCase,
    private readonly recurringExecution: RecurringExecutionPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: RecurringOccurrenceRequestedPayload): Promise<void> {
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
      this.logger.warn(
        `Skipping RecurringOccurrenceRequested: execution ${command.executionId} not found`,
      );
      return;
    }
    if (execution.status !== 'IN_PROGRESS') {
      this.logger.info(
        `Skipping RecurringOccurrenceRequested for execution ${command.executionId} (status ${execution.status})`,
      );
      return;
    }

    const startedAt = Date.now();
    try {
      const lines = asInvoiceLines(command.lines);
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
          this.logger.error(
            `autoPost failed for Invoice ${invoiceId.toString()}: ${(postErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      const message = (err as Error).message;
      await this.recurringExecution.fail(command.executionId, message);
      this.logger.error(
        `Recurring invoice generation failed for execution ${command.executionId}: ${message}`,
      );
    }
  }
}
