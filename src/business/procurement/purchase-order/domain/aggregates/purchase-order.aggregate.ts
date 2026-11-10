import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrderPricingService } from '../services/purchase-order-pricing.service';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { PurchaseOrderProps, PurchaseOrderStatus } from '../types/purchase-order.types';
import { ProductIdRef } from '../value-objects/product-id-ref.vo';
import { PurchaseOrderLine } from '../entities/purchase-order-line.entity';
import { PurchaseOrderApproved } from '../events/purchase-order.approved.event';
import { PurchaseOrderCancelled } from '../events/purchase-order.cancelled.event';
import { PurchaseOrderIssued } from '../events/purchase-order.issued.event';
import { PurchaseOrderCompleted } from '../events/purchase-order.completed.event';
import { PurchaseOrderAmended } from '../events/purchase-order.amended.event';
import { PurchaseOrderInvariants } from './purchase-order.invariants';

export class PurchaseOrder extends AggregateRoot<PurchaseOrderId> {
  private props: PurchaseOrderProps;

  private constructor(id: PurchaseOrderId, props: PurchaseOrderProps, version: number) {
    super(id);
    this.props = props;
    this.version = version;
  }

  static instantiate(
    id: PurchaseOrderId,
    props: PurchaseOrderProps,
    version: number,
  ): PurchaseOrder {
    return new PurchaseOrder(id, props, version);
  }

  get orderNumber(): string {
    return this.props.orderNumber;
  }

  get vendorId(): string {
    return this.props.vendorId.toString();
  }

  get externalReference(): string | undefined {
    return this.props.externalReference;
  }

  get orderDate(): Date | null {
    return this.props.orderDate ?? null;
  }

  get expectedDeliveryDate(): Date | null {
    return this.props.expectedDeliveryDate ?? null;
  }

  get createdBy(): string | null {
    return this.props.createdBy ?? null;
  }

  get approvedBy(): string | null {
    return this.props.approvedBy ?? null;
  }

  get approvedAt(): Date | null {
    return this.props.approvedAt ?? null;
  }

  get rejectedBy(): string | null {
    return this.props.rejectedBy ?? null;
  }

  get rejectedAt(): Date | null {
    return this.props.rejectedAt ?? null;
  }

  get rejectionReason(): string | null {
    return this.props.rejectionReason ?? null;
  }

  get issuedBy(): string | null {
    return this.props.issuedBy ?? null;
  }

  get amendedBy(): string | null {
    return this.props.amendedBy ?? null;
  }

  get amendedAt(): Date | null {
    return this.props.amendedAt ?? null;
  }

  get cancelledBy(): string | null {
    return this.props.cancelledBy ?? null;
  }

  get lastReceiptBy(): string | null {
    return this.props.lastReceiptBy ?? null;
  }

  get lastReceiptAt(): Date | null {
    return this.props.lastReceiptAt ?? null;
  }

  get status(): PurchaseOrderStatus {
    return this.props.status;
  }

  get currency(): string {
    return this.props.currency;
  }

  get lines(): readonly PurchaseOrderLine[] {
    return this.props.lines;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get subtotal(): Money {
    return this.props.lines.reduce(
      (acc, line) => acc.add(line.total),
      Money.ZERO(this.props.currency),
    );
  }

  get total(): Money {
    return this.subtotal;
  }

  private assertEditable(): void {
    PurchaseOrderInvariants.enforcePurchaseOrderEditable(this.props.status);
  }

  updateHeader(input: {
    orderDate?: Date;
    expectedDeliveryDate?: Date;
    externalReference?: string;
  }): void {
    this.assertEditable();
    if (input.orderDate !== undefined) this.props.orderDate = input.orderDate;
    if (input.expectedDeliveryDate !== undefined) {
      this.props.expectedDeliveryDate = input.expectedDeliveryDate;
    }
    if (input.externalReference !== undefined) {
      this.props.externalReference = input.externalReference;
    }
    this.props.updatedAt = new Date();
  }

  addLine(
    productId: string,
    quantity: number,
    unitPrice: Money,
    descriptionSnapshot?: string,
  ): void {
    this.assertEditable();
    PurchaseOrderInvariants.enforcePurchaseOrderLineQuantity(quantity);

    const existing = this.props.lines.find(line => line.productId.toString() === productId);
    if (existing) {
      const newQty = existing.quantity + quantity;
      const newTotal = PurchaseOrderPricingService.lineTotal(unitPrice, newQty);
      this.props.lines = this.props.lines.map(line =>
        line.productId.toString() === productId
          ? line.withUpdatedQuantity(newQty, unitPrice, newTotal)
          : line,
      );
    } else {
      const total = PurchaseOrderPricingService.lineTotal(unitPrice, quantity);
      this.props.lines.push(
        new PurchaseOrderLine(
          new ProductIdRef(productId),
          quantity,
          unitPrice,
          total,
          0,
          descriptionSnapshot ?? null,
        ),
      );
    }
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderLineAdded(this.id, productId));
  }

  setLine(
    productId: string,
    quantity: number,
    unitPrice: Money,
    descriptionSnapshot?: string,
  ): void {
    this.assertEditable();
    PurchaseOrderInvariants.enforcePurchaseOrderLineQuantity(quantity);

    const existing = this.props.lines.find(line => line.productId.toString() === productId);
    if (existing && existing.quantity === quantity && existing.unitPrice.equals(unitPrice)) {
      return false;
    }
    const total = unitPrice.multiply(quantity);
    if (existing) {
      this.props.lines = this.props.lines.map(l =>
        l.productId.toString() === productId ? l.withUpdatedQuantity(unitPrice, total) : l,
      );
    } else {
      this.props.lines.push(
        new PurchaseOrderLine(
          new ProductIdRef(productId),
          quantity,
          unitPrice,
          total,
          0,
          descriptionSnapshot ?? null,
        ),
      );
    }
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderLineAdded(this.id, productId));
    return true;
  }

  removeLine(productId: string): void {
    this.assertEditable();
    this.props.lines = this.props.lines.filter(line => line.productId.toString() !== productId);
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderLineRemoved(this.id, productId));
  }

  submit(): void {
    PurchaseOrderInvariants.enforcePurchaseOrderHasLines(this.props.lines.length);
    PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
      this.props.status,
      PurchaseOrderStatus.SUBMITTED,
    );
    this.props.status = PurchaseOrderStatus.SUBMITTED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderSubmitted(this.id, this.props.orderNumber, this.vendorId));
  }

  approve(actorId?: string): void {
    PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
      this.props.status,
      PurchaseOrderStatus.APPROVED,
    );
    this.props.status = PurchaseOrderStatus.APPROVED;
    this.props.approvedBy = actorId ?? null;
    this.props.approvedAt = new Date();
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderApproved(this.id));
  }

  reject(reason: string, actorId?: string): void {
    PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
      this.props.status,
      PurchaseOrderStatus.REJECTED,
    );
    this.props.status = PurchaseOrderStatus.REJECTED;
    this.props.rejectedBy = actorId ?? null;
    this.props.rejectedAt = new Date();
    this.props.rejectionReason = reason;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderRejected(this.id, reason));
  }

  cancel(actorId?: string, hasReceipts = false): void {
    PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
      this.props.status,
      PurchaseOrderStatus.CANCELLED,
    );
    if (hasReceipts) {
      throw Object.assign(new Error('Cannot cancel a purchase order with posted receipts'), {
        statusCode: 422,
      });
    }
    this.props.status = PurchaseOrderStatus.CANCELLED;
    this.props.cancelledBy = actorId ?? null;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderCancelled(this.id));
  }

  amend(changes: {
    expectedDeliveryDate?: Date | null;
    lineUnitPrices?: Record<string, number>;
    reason: string;
    actorId?: string;
  }): Record<string, unknown> {
    PurchaseOrderInvariants.enforcePurchaseOrderAmendable(this.props.status);

    const reason = changes.reason?.trim();
    if (!reason) {
      throw Object.assign(new Error('An amendment requires a reason'), { statusCode: 422 });
    }

    const applied: Record<string, unknown> = {};

    if (changes.expectedDeliveryDate !== undefined) {
      this.props.expectedDeliveryDate = changes.expectedDeliveryDate;
      applied['expectedDeliveryDate'] = changes.expectedDeliveryDate;
    }

    if (changes.lineUnitPrices && Object.keys(changes.lineUnitPrices).length > 0) {
      const prices: Record<string, string> = {};
      for (const [productId, minorUnits] of Object.entries(changes.lineUnitPrices)) {
        const line = this.props.lines.find(l => l.productId.toString() === productId);
        if (!line) {
          throw Object.assign(new Error(`Purchase order has no line for product ${productId}`), {
            statusCode: 404,
          });
        }
        if (line.receivedQuantity > 0) {
          throw Object.assign(
            new Error(
              `Line ${productId} already has a receipt and cannot be re-priced (${line.receivedQuantity} received)`,
            ),
            { statusCode: 422 },
          );
        }
        const unitPrice = Money.fromMinorUnits(minorUnits, this.props.currency);
        const total = unitPrice.multiply(line.quantity);
        this.props.lines = this.props.lines.map(l =>
          l.productId.toString() === productId ? l.withUpdatedQuantity(unitPrice, total) : l,
        );
        prices[productId] = unitPrice.toDecimal().toString();
      }
      applied['lineUnitPrices'] = prices;
    }

    if (Object.keys(applied).length === 0) {
      throw Object.assign(new Error('An amendment must change something'), { statusCode: 422 });
    }

    this.props.amendedBy = changes.actorId ?? this.props.amendedBy ?? null;
    this.props.amendedAt = new Date();
    this.props.amendmentReason = reason;
    this.props.updatedAt = new Date();

    this.addEvent(new PurchaseOrderAmended(this.id.toString(), applied, reason, changes.actorId));
    return applied;
  }

  issue(actorId?: string): void {
    PurchaseOrderInvariants.enforcePurchaseOrderHasLines(this.props.lines.length);
    PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
      this.props.status,
      PurchaseOrderStatus.ISSUED,
    );
    this.props.status = PurchaseOrderStatus.ISSUED;
    this.props.issuedBy = actorId ?? null;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderIssued(this.id));
  }

  close(): void {
    PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
      this.props.status,
      PurchaseOrderStatus.COMPLETED,
    );
    this.props.status = PurchaseOrderStatus.COMPLETED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderCompleted(this.id));
  }

  complete(): void {
    this.close();
  }
}
