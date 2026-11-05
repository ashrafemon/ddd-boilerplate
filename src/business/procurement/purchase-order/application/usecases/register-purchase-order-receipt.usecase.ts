import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
import { OpenQuantityService } from '../../domain/services/open-quantity.service';
import { PurchaseOrderStatusService } from '../../domain/services/purchase-order-status.service';
import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '../../public/contracts/purchase-order-receipt.contract';

@Injectable()
export class RegisterPurchaseOrderReceiptUseCase {
  constructor(
    private readonly repository: PurchaseOrderCommandRepository,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(request: PurchaseOrderReceiptRequest): Promise<PurchaseOrderReceiptResult> {
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new NotFoundException('Company not found in request context');
    }

    const abacResult = await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: 'PurchaseOrder',
      action: 'receive',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    const po = await this.repository.findById(request.purchaseOrderId);
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    PurchaseOrderFactory.openPoForReceipt(
      po,
      request,
      ctx.overReceiptTolerance ?? 0,
      false,
      '',
      ctx.defaultCurrency ?? 'USD',
      request.actorId,
    );

    await this.repository.update(po);

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
