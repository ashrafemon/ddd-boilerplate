import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import { RecurringExecutionPort } from '@platform/platform-common/recurring/ports/recurring-execution.port';
import { RecurringInvoiceGenerationPort } from '@business/sales/invoice/public/ports/recurring-invoice-generation.port';
import { GeneratedInvoiceResult } from '@business/sales/invoice/public/contracts/recurring-invoice-generation.contract';
import { CreateInvoiceUseCase } from '../use-cases/create-invoice.usecase';
import { GetInvoiceUseCase } from '../use-cases/get-invoice.usecase';
import { PostInvoiceUseCase } from '../use-cases/post-invoice.usecase';
import { InvoiceRecurringLineService } from '../../domain/services/invoice-recurring-line.service';

/**
 * Orchestrates recurring invoice generation: validates lines, creates invoice,
 * reads back snapshot, marks recurring execution complete, and optionally auto-posts.
 * All three internal use cases are composed here — never inside another use case.
 */
@Injectable()
export class RecurringInvoiceGenerationFacade extends RecurringInvoiceGenerationPort {
  private readonly logger = new Logger(RecurringInvoiceGenerationFacade.name);

  constructor(
    private readonly createInvoice: CreateInvoiceUseCase,
    private readonly getInvoice: GetInvoiceUseCase,
    private readonly postInvoice: PostInvoiceUseCase,
    private readonly recurringExecution: RecurringExecutionPort,
    private readonly loggerPort: LoggerPort,
  ) {
    super();
  }

  @Transactional()
  async generateRecurringInvoice(
    customerId: string,
    currency: string,
    lines: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>,
    autoPost: boolean,
  ): Promise<GeneratedInvoiceResult | null> {
    const normalizedLines = InvoiceRecurringLineService.validateAndMap(lines);
    const invoiceId = await this.createInvoice.execute({
      customerId,
      currency,
      lines: normalizedLines,
    });
    const snapshot = await this.getInvoice.execute(invoiceId);
    if (!snapshot) {
      throw new Error(`Generated invoice ${invoiceId} could not be read back`);
    }
    const result: GeneratedInvoiceResult = {
      invoiceId,
      snapshot: snapshot as unknown as Record<string, unknown>,
    };
    if (autoPost) {
      try {
        await this.postInvoice.execute(invoiceId);
      } catch (postErr) {
        this.loggerPort.error(
          `autoPost failed for Invoice ${invoiceId}: ${(postErr as Error).message}`,
        );
      }
    }
    return result;
  }
}
