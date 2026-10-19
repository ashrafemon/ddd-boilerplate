import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
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
    const po = await this.repository.findById(PurchaseOrderId.fromString(request.purchaseOrderId));
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

    const fullyReceived = po.lines.every(l => l.receivedQuantity >= l.quantity);
    const anyReceived = po.lines.some(l => l.receivedQuantity > 0);
    const receiptStatus: PurchaseOrderReceiptResult['receiptStatus'] = fullyReceived
      ? 'FULLY_RECEIVED'
      : anyReceived
        ? 'PARTIALLY_RECEIVED'
        : 'NOT_RECEIVED';

    return {
      purchaseOrderId: request.purchaseOrderId,
      receiptStatus,
      lines: po.lines.map(l => ({
        productId: l.productId.toString(),
        orderedQuantity: l.quantity,
        receivedQuantity: l.receivedQuantity,
        remainingQuantity: Math.max(0, l.quantity - l.receivedQuantity),
      })),
    };
  }
}
