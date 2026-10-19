import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { PurchaseOrderProps, PurchaseOrderStatus } from '../types/purchase-order.types';
import { ProductIdRef } from '../value-objects/purchase-order.vos';
import { PurchaseOrderLine } from '../entities/purchase-order-line.entity';
import { PurchaseOrderApproved } from '../events/purchase-order.approved.event';
import { PurchaseOrderCancelled } from '../events/purchase-order.cancelled.event';
import { PurchaseOrderIssued } from '../events/purchase-order.issued.event';
import { PurchaseOrderClosed } from '../events/purchase-order.closed.event';
import { PurchaseOrderLineAdded } from '../events/purchase-order.line-added.event';
import { PurchaseOrderLineRemoved } from '../events/purchase-order.line-removed.event';
import { PurchaseOrderRejected } from '../events/purchase-order.rejected.event';
import { PurchaseOrderSubmitted } from '../events/purchase-order.submitted.event';

export class PurchaseOrder extends AggregateRoot<PurchaseOrderId> {
  private props: PurchaseOrderProps;

  private constructor(id: PurchaseOrderId, props: PurchaseOrderProps, version: number) {
    super(id);
    this.props = props;
    this.version = version;
  }

  /** Construction entry point reserved for the domain factory. */
  static instantiate(
    id: PurchaseOrderId,
    props: PurchaseOrderProps,
    version: number,
  ): PurchaseOrder {
    return new PurchaseOrder(id, props, version);
  }

  get orderNumber(): string {
    return this.props.orderNumber.value;
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

  get cancelledBy(): string | null {
    return this.props.cancelledBy ?? null;
  }

  get lastReceiptBy(): string | null {
    return this.props.lastReceiptBy ?? null;
  }

  get lastReceiptAt(): Date | null {
    return this.props.lastReceiptAt ?? null;
  }

  recordReceipt(actorId?: string): void {
    this.props.updatedAt = new Date();
    this.props.lastReceiptBy = actorId ?? null;
    this.props.lastReceiptAt = new Date();
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
    invariantRegistry.enforce('purchase-order.editable', { status: this.props.status });
  }

  /**
   * Draft-header update (plan Phase 2.2 / spec §3.1): commercial fields only,
   * DRAFT-only — issued commercial terms change through amendments, not PATCH.
   */
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
    invariantRegistry.enforce('purchase-order.line-quantity', { quantity });

    const existing = this.props.lines.find(line => line.productId.toString() === productId);
    if (existing) {
      const newQty = existing.quantity + quantity;
      const newTotal = unitPrice.multiply(newQty);
      this.props.lines = this.props.lines.map(line =>
        line.productId.toString() === productId
          ? line.withUpdatedQuantity(newQty, unitPrice, newTotal)
          : line,
      );
    } else {
      const total = unitPrice.multiply(quantity);
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

  /**
   * Idempotent line write for bulk import: makes the line for `productId` exactly
   * (quantity, unitPrice) — replacing an existing line instead of summing into it,
   * so a redelivered import row can never double-count. Returns false (and raises
   * no event) when the line is already in that state.
   */
  setLine(
    productId: string,
    quantity: number,
    unitPrice: Money,
    descriptionSnapshot?: string,
  ): boolean {
    this.assertEditable();
    invariantRegistry.enforce('purchase-order.line-quantity', { quantity });

    const existing = this.props.lines.find(line => line.productId.toString() === productId);
    if (existing && existing.quantity === quantity && existing.unitPrice.equals(unitPrice)) {
      return false;
    }
    const total = unitPrice.multiply(quantity);
    if (existing) {
      this.props.lines = this.props.lines.map(line =>
        line === existing ? line.withUpdatedQuantity(quantity, unitPrice, total) : line,
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
    invariantRegistry.enforce('purchase-order.has-lines', { lineCount: this.props.lines.length });
    invariantRegistry.enforce('purchase-order.status-transition', {
      status: this.props.status,
      to: PurchaseOrderStatus.SUBMITTED,
    });
    this.props.status = PurchaseOrderStatus.SUBMITTED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderSubmitted(this.id, this.props.orderNumber.value, this.vendorId));
  }

  approve(actorId?: string): void {
    invariantRegistry.enforce('purchase-order.status-transition', {
      status: this.props.status,
      to: PurchaseOrderStatus.APPROVED,
    });
    this.props.status = PurchaseOrderStatus.APPROVED;
    this.props.approvedBy = actorId ?? null;
    this.props.approvedAt = new Date();
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderApproved(this.id));
  }

  reject(reason: string, actorId?: string): void {
    invariantRegistry.enforce('purchase-order.status-transition', {
      status: this.props.status,
      to: PurchaseOrderStatus.REJECTED,
    });
    this.props.status = PurchaseOrderStatus.REJECTED;
    this.props.rejectedBy = actorId ?? null;
    this.props.rejectedAt = new Date();
    this.props.rejectionReason = reason;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderRejected(this.id, reason));
  }

  /**
   * Cancel (plan Phase 2.4): the CancellationPolicy is enforced inside the
   * aggregate so the rule holds no matter where the command originates —
   * HTTP, batch worker or import. `hasReceipts` is caller-supplied domain
   * data (PO-owned projection), never queried by the domain itself.
   */
  cancel(actorId?: string, hasReceipts = false): void {
    invariantRegistry.enforce('purchase-order.status-transition', {
      status: this.props.status,
      to: PurchaseOrderStatus.CANCELLED,
    });
    policyRegistry.enforce('purchase-order.cancellation', {
      status: this.props.status,
      hasReceipts,
    });
    this.props.status = PurchaseOrderStatus.CANCELLED;
    this.props.cancelledBy = actorId ?? null;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderCancelled(this.id));
  }

  issue(actorId?: string): void {
    invariantRegistry.enforce('purchase-order.has-lines', {
      lineCount: this.props.lines.length,
    });
    invariantRegistry.enforce('purchase-order.status-transition', {
      status: this.props.status,
      to: PurchaseOrderStatus.ISSUED,
    });
    this.props.status = PurchaseOrderStatus.ISSUED;
    this.props.issuedBy = actorId ?? null;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderIssued(this.id));
  }

  close(): void {
    invariantRegistry.enforce('purchase-order.status-transition', {
      status: this.props.status,
      to: PurchaseOrderStatus.COMPLETED,
    });
    this.props.status = PurchaseOrderStatus.COMPLETED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderClosed(this.id));
  }

  complete(): void {
    // Legacy alias: delegates to close.
    this.close();
  }

  /**
   * Evaluate the approval policy. Enforces the registered policy and returns
   * whether manual approval is required for the current aggregate state.
   */
  requiresManualApproval(threshold: number): boolean {
    return policyRegistry.evaluate('purchase-order.approval', {
      status: this.props.status,
      totalAmount: this.total.amount,
      autoApproveThreshold: threshold,
    });
  }
}
