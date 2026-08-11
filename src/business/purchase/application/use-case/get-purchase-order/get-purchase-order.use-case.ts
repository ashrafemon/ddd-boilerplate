import { Injectable } from '@nestjs/common';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import {
  PurchaseOrderReadModel,
  PurchaseOrderReadRepositoryPort,
} from '../../../domain/port/purchase-order-read-repository.port';
import { GetPurchaseOrderInput, PurchaseOrderOutput } from '../../type/purchase-order.output';
import { GetPurchaseOrderPort } from '../../port/get-purchase-order.port';

/**
 * Query use case reading a purchase order through the read repository.
 */
@Injectable()
export class GetPurchaseOrderUseCase implements GetPurchaseOrderPort {
  constructor(private readonly readRepository: PurchaseOrderReadRepositoryPort) {}

  public async execute(input: GetPurchaseOrderInput): Promise<PurchaseOrderOutput> {
    const readModel = await this.readRepository.findById(input.purchaseOrderId);

    if (!readModel) {
      throw new AggregateNotFoundException('PurchaseOrder', input.purchaseOrderId);
    }

    return toOutput(readModel);
  }
}

export function toOutput(readModel: PurchaseOrderReadModel): PurchaseOrderOutput {
  return {
    id: readModel.id,
    tenantId: readModel.tenantId,
    organizationId: readModel.organizationId,
    number: readModel.number,
    vendorId: readModel.vendorId,
    vendorCode: readModel.vendorCode,
    vendorName: readModel.vendorName,
    status: readModel.status,
    currency: readModel.currency,
    totalCents: readModel.totalCents,
    notes: readModel.notes,
    submittedAt: readModel.submittedAt,
    approvedAt: readModel.approvedAt,
    approvedByUserId: readModel.approvedByUserId,
    rejectedAt: readModel.rejectedAt,
    rejectedReason: readModel.rejectedReason,
    cancelledAt: readModel.cancelledAt,
    cancelledReason: readModel.cancelledReason,
    completedAt: readModel.completedAt,
    lines: readModel.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      taxRateBps: line.taxRateBps,
      netAmountCents: line.netAmountCents,
      taxAmountCents: line.taxAmountCents,
      totalCents: line.totalCents,
    })),
  };
}
