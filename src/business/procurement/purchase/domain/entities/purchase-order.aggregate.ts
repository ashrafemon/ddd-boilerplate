import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { Money } from '@business/shared-business/domain/money.value-object';
import { invariantRegistry } from '@business/shared-business/domain/invariants/invariant.registry';
import { policyRegistry } from '@business/shared-business/domain/policies/policy.registry';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { OrderNumber, ProductIdRef, VendorIdRef } from '../value-objects/purchase-order.vos';
import { PurchaseOrderLine } from './purchase-order-line.entity';
import {
  PurchaseOrderApproved,
  PurchaseOrderCancelled,
  PurchaseOrderCompleted,
  PurchaseOrderLineAdded,
  PurchaseOrderLineRemoved,
  PurchaseOrderRejected,
  PurchaseOrderSubmitted,
} from '../events/purchase-order.events';

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export interface PurchaseOrderProps {
  orderNumber: OrderNumber;
  vendorId: VendorIdRef;
  status: PurchaseOrderStatus;
  currency: string;
  lines: PurchaseOrderLine[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePurchaseOrderInput {
  orderNumber: string;
  vendorId: string;
  currency?: string;
}

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

  addLine(productId: string, quantity: number, unitPrice: Money): void {
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
        new PurchaseOrderLine(new ProductIdRef(productId), quantity, unitPrice, total),
      );
    }
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderLineAdded(this.id, productId));
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

  approve(): void {
    invariantRegistry.enforce('purchase-order.status-transition', {
      status: this.props.status,
      to: PurchaseOrderStatus.APPROVED,
    });
    this.props.status = PurchaseOrderStatus.APPROVED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderApproved(this.id));
  }

  reject(reason: string): void {
    invariantRegistry.enforce('purchase-order.status-transition', {
      status: this.props.status,
      to: PurchaseOrderStatus.REJECTED,
    });
    this.props.status = PurchaseOrderStatus.REJECTED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderRejected(this.id, reason));
  }

  cancel(): void {
    invariantRegistry.enforce('purchase-order.status-transition', {
      status: this.props.status,
      to: PurchaseOrderStatus.CANCELLED,
    });
    this.props.status = PurchaseOrderStatus.CANCELLED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderCancelled(this.id));
  }

  complete(): void {
    invariantRegistry.enforce('purchase-order.status-transition', {
      status: this.props.status,
      to: PurchaseOrderStatus.COMPLETED,
    });
    this.props.status = PurchaseOrderStatus.COMPLETED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderCompleted(this.id));
  }

  /**
   * Evaluate the approval policy. Enforces the registered policy and returns
   * whether manual approval is required for the current aggregate state.
   */
  requiresManualApproval(threshold: number): boolean {
    const result = policyRegistry.evaluate('purchase-order.approval', {
      status: this.props.status,
      totalAmount: this.total.amount,
      autoApproveThreshold: threshold,
    });
    if (!result.ok) {
      return false;
    }
    return result.value === true;
  }
}
