import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import { RecurringExecutionPort } from '@platform/platform-common/recurring/ports/recurring-execution.port';
import { RecurringPurchaseOrderGenerationPort } from '@business/procurement/purchase-order/public/ports/recurring-purchase-order-generation.port';
import { GeneratedPurchaseOrderResult } from '@business/procurement/purchase-order/public/contracts/recurring-purchase-order-generation.contract';
import { CreatePurchaseOrderUseCase } from '../use-cases/create-purchase-order.usecase';
import { AddPurchaseOrderLineUseCase } from '../use-cases/add-purchase-order-line.usecase';
import { GetPurchaseOrderUseCase } from '../use-cases/get-purchase-order.usecase';
import { SubmitPurchaseOrderUseCase } from '../use-cases/submit-purchase-order.usecase';
import { PurchaseOrderRecurringLineService } from '../../domain/services/purchase-order-recurring-line.service';

/**
 * Orchestrates recurring purchase order generation: creates PO, adds lines,
 * reads back snapshot, marks recurring execution complete, and optionally
 * submits. All four internal use cases are composed here — never inside
 * another use case.
 */
@Injectable()
export class RecurringPurchaseOrderGenerationFacade extends RecurringPurchaseOrderGenerationPort {
  private readonly logger = new Logger(RecurringPurchaseOrderGenerationFacade.name);

  constructor(
    private readonly createPurchaseOrder: CreatePurchaseOrderUseCase,
    private readonly addPurchaseOrderLine: AddPurchaseOrderLineUseCase,
    private readonly getPurchaseOrder: GetPurchaseOrderUseCase,
    private readonly submitPurchaseOrder: SubmitPurchaseOrderUseCase,
    private readonly recurringExecution: RecurringExecutionPort,
    private readonly loggerPort: LoggerPort,
  ) {
    super();
  }

  @Transactional()
  async generateRecurringPurchaseOrder(
    vendorId: string,
    currency: string,
    lines: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>,
    autoPost: boolean,
  ): Promise<GeneratedPurchaseOrderResult | null> {
    const normalizedLines = PurchaseOrderRecurringLineService.validateAndMap(lines);
    const purchaseOrderId = await this.createPurchaseOrder.execute({
      vendorId,
      currency,
    });
    for (const line of normalizedLines) {
      await this.addPurchaseOrderLine.execute({
        id: purchaseOrderId.toString(),
        ...line,
      });
    }
    const snapshot = await this.getPurchaseOrder.execute(purchaseOrderId.toString());
    if (!snapshot) {
      throw new Error(`Generated purchase order ${purchaseOrderId} could not be read back`);
    }
    const result: GeneratedPurchaseOrderResult = {
      purchaseOrderId: purchaseOrderId.toString(),
      snapshot: snapshot as unknown as Record<string, unknown>,
    };
    if (autoPost) {
      try {
        await this.submitPurchaseOrder.execute(purchaseOrderId.toString());
      } catch (submitErr) {
        this.loggerPort.error(
          `autoPost submit failed for PurchaseOrder ${purchaseOrderId}: ${(submitErr as Error).message}`,
        );
      }
    }
    return result;
  }
}
