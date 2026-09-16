import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { ConflictException, Injectable } from '@nestjs/common';
import { LoggerPort } from '@platform/observability/ports/logger.port';
import { RecurringExecutionPort } from '@platform/recurring/ports/recurring-execution.port';
import { asPurchaseOrderLines } from '../integrations/recurring-purchase-order.mapper';
import { RecurringOccurrenceRequestedPayload } from '../integrations/recurring-occurrence.types';
import { AddPurchaseOrderLineUseCase } from './add-purchase-order-line.usecase';
import { CreatePurchaseOrderUseCase } from './create-purchase-order.usecase';
import { GetPurchaseOrderUseCase } from './get-purchase-order.usecase';
import { PurchaseOrderTransitionUseCase } from './purchase-order-transition.usecase';

/**
 * Creates a purchase order from a RecurringOccurrenceRequested integration
 * event (outbox → RabbitMQ → listener). Completes (or fails) the claimed
 * Recurring execution so the platform bookkeeping stays consistent.
 */
@Injectable()
export class GenerateRecurringPurchaseOrderUseCase {
  constructor(
    private readonly createPurchaseOrder: CreatePurchaseOrderUseCase,
    private readonly addPurchaseOrderLine: AddPurchaseOrderLineUseCase,
    private readonly getPurchaseOrder: GetPurchaseOrderUseCase,
    private readonly purchaseOrderTransition: PurchaseOrderTransitionUseCase,
    private readonly recurringExecution: RecurringExecutionPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: RecurringOccurrenceRequestedPayload): Promise<void> {
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
      const lines = asPurchaseOrderLines(command.lines);
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
          this.logger.error(
            `autoPost submit failed for PurchaseOrder ${purchaseOrderId.toString()}: ${(submitErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      const message = FailureMessage.of(err);
      await this.recurringExecution.fail(command.executionId, message);
      this.logger.error(
        `Recurring purchase order generation failed for execution ${command.executionId}: ${message}`,
      );
    }
  }
}
