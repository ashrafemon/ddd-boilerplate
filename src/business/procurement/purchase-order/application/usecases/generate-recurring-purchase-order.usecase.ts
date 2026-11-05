import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RecurringExecutionPort } from '@platform/platform-common/recurring/ports/recurring-execution.port';
import { RecurringOccurrenceRequestedPayload } from '../types/recurring-occurrence.types';
import { AddPurchaseOrderLineUseCase } from './add-purchase-order-line.usecase';
import { CreatePurchaseOrderUseCase } from './create-purchase-order.usecase';
import { GetPurchaseOrderUseCase } from './get-purchase-order.usecase';
import { PurchaseOrderTransitionUseCase } from './purchase-order-transition.usecase';

@Injectable()
export class GenerateRecurringPurchaseOrderUseCase {
  private readonly logger = new Logger(GenerateRecurringPurchaseOrderUseCase.name);

  constructor(
    private readonly createPurchaseOrder: CreatePurchaseOrderUseCase,
    private readonly addPurchaseOrderLine: AddPurchaseOrderLineUseCase,
    private readonly getPurchaseOrder: GetPurchaseOrderUseCase,
    private readonly purchaseOrderTransition: PurchaseOrderTransitionUseCase,
    private readonly recurringExecution: RecurringExecutionPort,
    private readonly loggerPort: LoggerPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  async execute(command: RecurringOccurrenceRequestedPayload): Promise<void> {
    await this.requestContext.run({ tenantId: command.tenantId }, () => this.run(command));
  }

  private async run(command: RecurringOccurrenceRequestedPayload): Promise<void> {
    if (command.targetEntityType && command.targetEntityType !== 'PurchaseOrder') {
      return;
    }
    if (!command.executionId) {
      throw new ConflictException('RecurringOccurrenceRequested.executionId is required');
    }
    if (!command.partyId) {
      throw new ConflictException('Recurring PurchaseOrder occurrence requires a vendor partyId');
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
      const lines = this.asPurchaseOrderLines(command.lines);
      const purchaseOrderId = await this.createPurchaseOrder.execute({
        vendorId: command.partyId,
        currency: command.currency,
      });
      for (const line of lines) {
        await this.addPurchaseOrderLine.execute({ id: purchaseOrderId.toString(), ...line });
      }

      const snapshot = await this.getPurchaseOrder.execute(purchaseOrderId.toString());
      if (!snapshot) {
        throw new ConflictException(
          `Generated purchase order ${purchaseOrderId.toString()} could not be read back`,
        );
      }
      await this.recurringExecution.complete(command.executionId, {
        generatedDocumentId: purchaseOrderId.toString(),
        generatedSnapshot: snapshot as unknown as Record<string, unknown>,
        executionTimeMs: Date.now() - startedAt,
      });

      if (command.autoPost) {
        try {
          await this.purchaseOrderTransition.execute({
            id: purchaseOrderId.toString(),
            transition: 'submit',
          });
        } catch (submitErr) {
          this.loggerPort.error(
            `autoPost submit failed for PurchaseOrder ${purchaseOrderId.toString()}: ${(submitErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      const message = FailureMessage.of(err);
      await this.recurringExecution.fail(command.executionId, message);
      this.loggerPort.error(
        `Recurring purchase order generation failed for execution ${command.executionId}: ${message}`,
      );
    }
  }

  private asPurchaseOrderLines(
    lines: unknown[],
  ): Omit<import('../../domain/types/purchase-order.types').AddLineInput, 'id'>[] {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new ConflictException('Recurring PurchaseOrder template must have at least one line');
    }
    return lines.map((raw, index) => {
      const line = raw as Record<string, unknown>;
      const productId = this.stringField(line, 'productId', `lines[${index}]`);
      const quantity = this.numberField(line, 'quantity', `lines[${index}]`);
      const unitPrice = this.numberField(line, 'unitPrice', `lines[${index}]`);
      return { productId, quantity, unitPrice };
    });
  }

  private stringField(source: Record<string, unknown>, key: string, prefix: string): string {
    const value = source[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new ConflictException(`Recurring PurchaseOrder ${prefix}.${key} is required`);
    }
    return value;
  }

  private numberField(source: Record<string, unknown>, key: string, prefix: string): number {
    const value = Number(source[key]);
    if (!Number.isFinite(value)) {
      throw new ConflictException(`Recurring PurchaseOrder ${prefix}.${key} must be a number`);
    }
    return value;
  }
}
