import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { Money } from '@business/shared-business/domain/money.value-object';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { OrderNumber, ProductIdRef, VendorIdRef } from '../value-objects/purchase-order.vos';
import { PurchaseOrderInvariants } from '../invariants/purchase-order.invariants';
import { InvariantException } from '@business/shared-business/errors/invariant-violate.error';
import {
  PurchaseOrderApproved,
  PurchaseOrderCancelled,
  PurchaseOrderCompleted,
  PurchaseOrderCreated,
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

export class PurchaseOrderLine {
  constructor(
    public readonly productId: ProductIdRef,
    public readonly quantity: number,
    public readonly unitPrice: Money,
    public readonly total: Money,
  ) {}
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

  static create(input: CreatePurchaseOrderInput): PurchaseOrder {
    const now = new Date();
    const purchaseOrder = new PurchaseOrder(
      PurchaseOrderId.generate(),
      {
        orderNumber: OrderNumber.create(input.orderNumber),
        vendorId: new VendorIdRef(input.vendorId),
        status: PurchaseOrderStatus.DRAFT,
        currency: input.currency ?? 'USD',
        lines: [],
        createdAt: now,
        updatedAt: now,
      },
      1,
    );
    purchaseOrder.addEvent(
      new PurchaseOrderCreated(
        purchaseOrder.id,
        purchaseOrder.props.orderNumber.value,
        input.vendorId,
      ),
    );
    return purchaseOrder;
  }

  static reconstitute(
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
    if (this.props.status !== PurchaseOrderStatus.DRAFT) {
      throw new InvariantException(
        `Cannot modify a purchase order in status ${this.props.status}; only DRAFT orders are editable`,
      );
    }
  }

  addLine(productId: string, quantity: number, unitPrice: Money): void {
    this.assertEditable();
    PurchaseOrderInvariants.assertQuantityPositive(quantity);

    const existing = this.props.lines.find(line => line.productId.toString() === productId);
    if (existing) {
      const newQty = existing.quantity + quantity;
      const newTotal = unitPrice.multiply(newQty);
      this.props.lines = this.props.lines.map(line =>
        line.productId.toString() === productId
          ? new PurchaseOrderLine(line.productId, newQty, unitPrice, newTotal)
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
    PurchaseOrderInvariants.assertHasLines(this.props.lines.length);
    PurchaseOrderInvariants.assertValidStatusTransition(
      this.props.status,
      PurchaseOrderStatus.SUBMITTED,
    );
    this.props.status = PurchaseOrderStatus.SUBMITTED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderSubmitted(this.id, this.props.orderNumber.value, this.vendorId));
  }

  approve(): void {
    PurchaseOrderInvariants.assertValidStatusTransition(
      this.props.status,
      PurchaseOrderStatus.APPROVED,
    );
    this.props.status = PurchaseOrderStatus.APPROVED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderApproved(this.id));
  }

  reject(reason: string): void {
    PurchaseOrderInvariants.assertValidStatusTransition(
      this.props.status,
      PurchaseOrderStatus.REJECTED,
    );
    this.props.status = PurchaseOrderStatus.REJECTED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderRejected(this.id, reason));
  }

  cancel(): void {
    PurchaseOrderInvariants.assertValidStatusTransition(
      this.props.status,
      PurchaseOrderStatus.CANCELLED,
    );
    this.props.status = PurchaseOrderStatus.CANCELLED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderCancelled(this.id));
  }

  complete(): void {
    PurchaseOrderInvariants.assertValidStatusTransition(
      this.props.status,
      PurchaseOrderStatus.COMPLETED,
    );
    this.props.status = PurchaseOrderStatus.COMPLETED;
    this.props.updatedAt = new Date();
    this.addEvent(new PurchaseOrderCompleted(this.id));
  }
}
