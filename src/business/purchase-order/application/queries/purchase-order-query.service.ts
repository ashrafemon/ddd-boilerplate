import { Inject, Injectable } from '@nestjs/common';
import {
  PurchaseOrderLineSummary,
  PurchaseOrderQueryPort,
  PurchaseOrderSummary,
} from '../../ports/inbound/purchase-order.query.port';
import {
  PURCHASE_ORDER_REPOSITORY,
  PurchaseOrderRepositoryPort,
} from '../../ports/outbound/purchase-order-repository.port';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PageQuery, PageResult, buildPageResult } from '@shared-kernel/types/pagination';
import { PurchaseOrder, PurchaseOrderLine } from '../../domain/entities/purchase-order.aggregate';

function toLineSummary(line: PurchaseOrderLine): PurchaseOrderLineSummary {
  return {
    productId: line.productId.toString(),
    quantity: line.quantity,
    unitPrice: line.unitPrice.amount,
    total: line.total.amount,
  };
}

function toSummary(purchaseOrder: PurchaseOrder): PurchaseOrderSummary {
  return {
    id: purchaseOrder.id.toString(),
    orderNumber: purchaseOrder.orderNumber,
    vendorId: purchaseOrder.vendorId,
    status: purchaseOrder.status,
    currency: purchaseOrder.currency,
    subtotal: purchaseOrder.subtotal.amount,
    total: purchaseOrder.total.amount,
    lines: purchaseOrder.lines.map(toLineSummary),
    createdAt: purchaseOrder.createdAt,
    updatedAt: purchaseOrder.updatedAt,
  };
}

@Injectable()
export class PurchaseOrderQueryService implements PurchaseOrderQueryPort {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly purchaseOrderRepository: PurchaseOrderRepositoryPort,
  ) {}

  async getPurchaseOrder(id: PurchaseOrderId): Promise<PurchaseOrderSummary | null> {
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    return purchaseOrder ? toSummary(purchaseOrder) : null;
  }

  async listPurchaseOrders(query: PageQuery): Promise<PageResult<PurchaseOrderSummary>> {
    const { items, total } = await this.purchaseOrderRepository.findAll(query);
    return buildPageResult(items.map(toSummary), total, query);
  }
}
