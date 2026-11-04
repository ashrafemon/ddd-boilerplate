import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
import { OpenQuantityService } from '../../domain/services/open-quantity.service';
import { PurchaseOrderStatusService } from '../../domain/services/purchase-order-status.service';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';
import { ReadCachePort } from '../outbound-ports/read-cache.port';
import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '../../public/contracts/purchase-order-receipt.contract';

@Injectable()
export class RegisterPurchaseOrderReceiptUseCase {
  constructor(
    private readonly repository: PurchaseOrderCommandRepository,
    private readonly companyConfig: CompanyConfigPort,
    private readonly readCache: ReadCachePort,
  ) {}

  @Transactional()
  async execute(request: PurchaseOrderReceiptRequest): Promise<PurchaseOrderReceiptResult> {
    const po = await this.repository.findById(request.purchaseOrderId);
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    const company = await this.companyConfig.getCompanyConfig();

    PurchaseOrderFactory.openPoForReceipt(
      po,
      request,
      company.overReceiptTolerance,
      false,
      '',
      company.defaultCurrency,
      request.actorId,
    );

    await this.repository.update(po);

    await this.readCache.invalidate(`purchase-order:${po.id.toString()}`);

    const derived = PurchaseOrderStatusService.deriveReceiptStatus(po.lines);
    const receiptStatus: PurchaseOrderReceiptResult['receiptStatus'] =
      derived === 'FULL'
        ? 'FULLY_RECEIVED'
        : derived === 'PARTIAL'
          ? 'PARTIALLY_RECEIVED'
          : 'NOT_RECEIVED';

    return {
      purchaseOrderId: request.purchaseOrderId,
      receiptStatus,
      lines: po.lines.map(l => ({
        productId: l.productId.toString(),
        orderedQuantity: l.quantity,
        receivedQuantity: l.receivedQuantity,
        remainingQuantity: OpenQuantityService.openQuantity(l.quantity, l.receivedQuantity),
      })),
    };
  }
}
