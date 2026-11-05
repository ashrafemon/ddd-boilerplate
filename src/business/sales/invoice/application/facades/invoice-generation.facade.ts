import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { ConflictException, Injectable } from '@nestjs/common';
import { LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RecurringExecutionPort } from '@platform/platform-common/recurring/ports/recurring-execution.port';
import { RecurringOccurrenceRequestedPayload } from '../types/recurring-occurrence.types';
import { CreateInvoiceUseCase } from '../usecases/create-invoice.usecase';
import { InvoiceLineInput } from '../../domain/types/invoice.types';
import { JsonValue } from '@shared-kernel/types/json-value.type';
import { GetInvoiceUseCase } from '../usecases/get-invoice.usecase';
import { PostInvoiceUseCase } from '../usecases/post-invoice.usecase';

@Injectable()
export class InvoiceGenerationFacade {
  constructor(
    private readonly createInvoice: CreateInvoiceUseCase,
    private readonly getInvoice: GetInvoiceUseCase,
    private readonly postInvoice: PostInvoiceUseCase,
    private readonly recurringExecution: RecurringExecutionPort,
    private readonly logger: LoggerPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async generate(command: RecurringOccurrenceRequestedPayload): Promise<void> {
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
      const lines = this.toLines(command.lines);
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
      const message = FailureMessage.of(err);
      await this.recurringExecution.fail(command.executionId, message);
      this.logger.error(
        `Recurring invoice generation failed for execution ${command.executionId}: ${message}`,
      );
    }
  }

  private toLines(lines: JsonValue[]): InvoiceLineInput[] {
    if (lines.length === 0) {
      throw new ConflictException('Recurring Invoice template must have at least one line');
    }
    return lines.map((raw, index) => {
      const line = this.asObject(raw, index);
      return {
        description: this.stringField(line, 'description', index),
        quantity: this.numberField(line, 'quantity', index),
        unitPrice: this.numberField(line, 'unitPrice', index),
      };
    });
  }

  private asObject(raw: JsonValue, index: number): Record<string, JsonValue> {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ConflictException(`Recurring Invoice lines[${index}] must be an object`);
    }
    return raw;
  }

  private stringField(line: Record<string, JsonValue>, key: string, index: number): string {
    const value = line[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new ConflictException(`Recurring Invoice lines[${index}].${key} is required`);
    }
    return value;
  }

  private numberField(line: Record<string, JsonValue>, key: string, index: number): number {
    const value = line[key];
    const numeric =
      typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(numeric)) {
      throw new ConflictException(`Recurring Invoice lines[${index}].${key} must be a number`);
    }
    return numeric;
  }
}
