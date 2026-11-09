import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RecurringExecutionPort } from '@platform/platform-common/recurring/ports/recurring-execution.port';
import { RecurringOccurrenceRequestedPayload } from '../../domain/types/recurring-occurrence.types';
import { AddPurchaseOrderLineUseCase } from './add-purchase-order-line.usecase';
import { CreatePurchaseOrderUseCase } from './create-purchase-order.usecase';
import { GetPurchaseOrderUseCase } from './get-purchase-order.usecase';
import { PurchaseOrderTransitionUseCase } from './purchase-order-transition.usecase';
import { PurchaseOrderRecurringLineService } from '../../domain/services/purchase-order-recurring-line.service';

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
      const lines = PurchaseOrderRecurringLineService.validateAndMap(command.lines);
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
}
