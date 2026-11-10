import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { FailureMessage } from '@common/application/utils/failure-message';
import { LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RecurringExecutionPort } from '@platform/platform-common/recurring/ports/recurring-execution.port';
import { RecurringOccurrenceRequestedPayload } from '../../domain/types/recurring-occurrence.types';
import { RecurringPurchaseOrderGenerationPort } from '@business/procurement/purchase-order/public/ports/recurring-purchase-order-generation.port';

/**
 * Recurring purchase order execution trigger. Delegates all business
 * orchestration (create → add lines → snapshot → submit) to
 * RecurringPurchaseOrderGenerationFacade. This use case owns only the
 * recurring-execution lifecycle (find/complete/fail).
 */
@Injectable()
export class GenerateRecurringPurchaseOrderUseCase {
  private readonly logger = new Logger(GenerateRecurringPurchaseOrderUseCase.name);

  constructor(
    private readonly recurringPurchaseOrderGeneration: RecurringPurchaseOrderGenerationPort,
    private readonly recurringExecution: RecurringExecutionPort,
    private readonly loggerPort: LoggerPort,
    private readonly requestContext: RequestContextPort,
  ) {}

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
      const normalizedLines = command.lines.map(
        (l: { productId: string; quantity: number; unitPrice: number }) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        }),
      );
      const result = await this.recurringPurchaseOrderGeneration.generateRecurringPurchaseOrder(
        command.partyId,
        command.currency,
        normalizedLines,
        command.autoPost,
      );
      await this.recurringExecution.complete(command.executionId, {
        generatedDocumentId: result!.purchaseOrderId,
        generatedSnapshot: result!.snapshot,
        executionTimeMs: Date.now() - startedAt,
      });
    } catch (err) {
      const message = FailureMessage.of(err);
      await this.recurringExecution.fail(command.executionId, message);
      this.loggerPort.error(
        `Recurring purchase order generation failed for execution ${command.executionId}: ${message}`,
      );
    }
  }
}
