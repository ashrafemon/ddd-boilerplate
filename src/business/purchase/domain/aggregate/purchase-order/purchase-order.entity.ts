import { AggregateRoot } from '../../../../../shared-business/domain/aggregate-root';
import { Currency } from '../../../../../shared-business/value-object/currency';
import { Money } from '../../../../../shared-business/value-object/money';
import { OrganizationId } from '../../../../../shared-business/value-object/organization-id';
import { Quantity } from '../../../../../shared-business/value-object/quantity';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { ConflictException } from '../../../../../shared-kernel/exceptions/conflict.exception';
import { PurchaseOrderCreatedEvent, PurchaseOrderSubmittedEvent } from '../../event/purchase-order-lifecycle.event';
import {
  PurchaseOrderCancelledEvent,
  PurchaseOrderCompletedEvent,
  PurchaseOrderRejectedEvent,
} from '../../event/purchase-order-status.event';
import { PurchaseOrderApprovedEvent } from '../../event/purchase-order-approved.event';
import { PurchaseOrderNumber } from '../../value-object/purchase-order-number.vo';
import {
  PurchaseOrderStatus,
  PurchaseOrderStatusValue,
} from '../../value-object/purchase-order-status.vo';
import { VendorReference } from '../../value-object/vendor-reference.vo';
import { PurchaseOrderId } from './purchase-order-id.vo';
import { PurchaseOrderLine } from './purchase-order-line.entity';

export interface PurchaseOrderSnapshot {
  id: PurchaseOrderId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  number: PurchaseOrderNumber;
  vendor: VendorReference;
  status: PurchaseOrderStatus;
  currency: string;
  lines: PurchaseOrderLine[];
  notes?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  approvedByUserId?: string;
  rejectedAt?: Date;
  rejectedReason?: string;
  cancelledAt?: Date;
  cancelledReason?: string;
  completedAt?: Date;
}

/**
 * PurchaseOrder aggregate root.
 *
 * It controls every entity and value object inside the aggregate (lines,
 * money, quantities, references). External code can only call the documented
 * state-changing methods; it can never mutate fields or child lines directly.
 */
export class PurchaseOrder extends AggregateRoot<PurchaseOrderId> {
  private readonly tenantId: TenantId;
  private readonly organizationId: OrganizationId;
  private number!: PurchaseOrderNumber;
  private vendor!: VendorReference;
  private status!: PurchaseOrderStatus;
  private currency!: string;  private lines: PurchaseOrderLine[] = [];
  private notes?: string;
  private submittedAt?: Date;
  private approvedAt?: Date;
  private approvedByUserId?: string;
  private rejectedAt?: Date;
  private rejectedReason?: string;
  private cancelledAt?: Date;
  private cancelledReason?: string;
  private completedAt?: Date;

  private constructor(id: PurchaseOrderId, tenantId: TenantId, organizationId: OrganizationId) {
    super(id);
    this.tenantId = tenantId;
    this.organizationId = organizationId;
  }

  public static create(input: {
    id: PurchaseOrderId;
    tenantId: TenantId;
    organizationId: OrganizationId;
    number: PurchaseOrderNumber;
    vendor: VendorReference;
    currency: string;
    notes?: string;
  }): PurchaseOrder {
    const order = new PurchaseOrder(input.id, input.tenantId, input.organizationId);
    order.number = input.number;
    order.vendor = input.vendor;
    order.status = PurchaseOrderStatus.draft();
    order.currency = input.currency;
    order.notes = input.notes;
    return order;
  }

  public static reconstitute(snapshot: PurchaseOrderSnapshot): PurchaseOrder {
    const order = new PurchaseOrder(snapshot.id, snapshot.tenantId, snapshot.organizationId);
    order.number = snapshot.number;
    order.vendor = snapshot.vendor;
    order.status = snapshot.status;
    order.currency = snapshot.currency;
    order.lines = snapshot.lines;
    order.notes = snapshot.notes;
    order.submittedAt = snapshot.submittedAt;
    order.approvedAt = snapshot.approvedAt;
    order.approvedByUserId = snapshot.approvedByUserId;
    order.rejectedAt = snapshot.rejectedAt;
    order.rejectedReason = snapshot.rejectedReason;
    order.cancelledAt = snapshot.cancelledAt;
    order.cancelledReason = snapshot.cancelledReason;
    order.completedAt = snapshot.completedAt;
    order.clearDomainEvents();
    return order;
  }

  public getTenantId(): TenantId {
    return this.tenantId;
  }

  public getOrganizationId(): OrganizationId {
    return this.organizationId;
  }

  public getNumber(): PurchaseOrderNumber {
    return this.number;
  }

  public getVendor(): VendorReference {
    return this.vendor;
  }

  public getStatus(): PurchaseOrderStatus {
    return this.status;
  }

  public getStatusValue(): PurchaseOrderStatusValue {
    return this.status.getValue();
  }

  public getCurrency(): string {
    return this.currency;
  }

  public getLines(): readonly PurchaseOrderLine[] {
    return [...this.lines];
  }

  public getNotes(): string | undefined {
    return this.notes;
  }

  public getTotal(): Money {
    return this.lines.reduce(
      (total, line) => total.add(line.getTotalAmount()),
      Money.zero(Currency.from(this.currency)),
    );
  }

  public getApprovedAt(): Date | undefined {
    return this.approvedAt;
  }

  public getApprovedByUserId(): string | undefined {
    return this.approvedByUserId;
  }

  public getSubmittedAt(): Date | undefined {
    return this.submittedAt;
  }

  public getRejectedAt(): Date | undefined {
    return this.rejectedAt;
  }

  public getRejectedReason(): string | undefined {
    return this.rejectedReason;
  }

  public getCancelledAt(): Date | undefined {
    return this.cancelledAt;
  }

  public getCancelledReason(): string | undefined {
    return this.cancelledReason;
  }

  public getCompletedAt(): Date | undefined {
    return this.completedAt;
  }

  // ── Mutation API (the only way to change the aggregate) ─────────────

  public addLine(line: PurchaseOrderLine): void {
    this.assertStatus(PurchaseOrderStatusValue.DRAFT, 'add lines');
    this.lines = [...this.lines, line];
  }

  public removeLine(lineId: string): void {
    this.assertStatus(PurchaseOrderStatusValue.DRAFT, 'remove lines');
    this.lines = this.lines.filter((line) => line.getId().getValue() !== lineId);
  }

  public changeLineQuantity(lineId: string, quantity: Quantity): void {
    this.assertStatus(PurchaseOrderStatusValue.DRAFT, 'change line quantities');
    this.lines = this.lines.map((line) => {
      if (line.getId().getValue() !== lineId) return line;
      const updated = PurchaseOrderLine.reconstitute(
        line.getId(),
        line.getLineNumber(),
        line.getProduct(),
        line.getDescription(),
        quantity,
        line.getUnitPrice(),
        line.getTaxRate(),
      );
      return updated;
    });
  }

  public changeVendor(vendor: VendorReference): void {
    this.assertStatus(PurchaseOrderStatusValue.DRAFT, 'change the vendor');
    this.vendor = vendor;
  }

  public changeNotes(notes?: string): void {
    this.assertStatus(PurchaseOrderStatusValue.DRAFT, 'change the notes');
    this.notes = notes;
  }

  public submit(): void {
    this.transitionTo(PurchaseOrderStatusValue.SUBMITTED);
    this.submittedAt = new Date();
    this.recordDomainEvent(new PurchaseOrderSubmittedEvent(this.getId().getValue(), this.number.getValue()));
  }

  public approve(approvedByUserId?: string): void {
    this.transitionTo(PurchaseOrderStatusValue.APPROVED);
    this.approvedAt = new Date();
    this.approvedByUserId = approvedByUserId;
    this.recordDomainEvent(new PurchaseOrderApprovedEvent(this.getId().getValue(), this.number.getValue()));
  }

  public reject(reason: string): void {
    this.transitionTo(PurchaseOrderStatusValue.REJECTED);
    this.rejectedAt = new Date();
    this.rejectedReason = reason;
    this.recordDomainEvent(new PurchaseOrderRejectedEvent(this.getId().getValue(), reason));
  }

  public cancel(reason: string): void {
    this.transitionTo(PurchaseOrderStatusValue.CANCELLED);
    this.cancelledAt = new Date();
    this.cancelledReason = reason;
    this.recordDomainEvent(new PurchaseOrderCancelledEvent(this.getId().getValue(), reason));
  }

  public complete(): void {
    this.transitionTo(PurchaseOrderStatusValue.COMPLETED);
    this.completedAt = new Date();
    this.recordDomainEvent(new PurchaseOrderCompletedEvent(this.getId().getValue(), this.number.getValue()));
  }

  public markCreated(): void {
    this.recordDomainEvent(new PurchaseOrderCreatedEvent(this.getId().getValue(), this.number.getValue()));
  }

  // ── Internal helpers ────────────────────────────────────────────────

  private transitionTo(target: PurchaseOrderStatusValue): void {
    if (!this.status.canTransitionTo(target)) {
      throw new ConflictException(
        `Cannot transition purchase order from ${this.status.getValue()} to ${target}`,
      );
    }
    this.status = PurchaseOrderStatus.from(target);
  }

  private assertStatus(expected: PurchaseOrderStatusValue, action: string): void {
    if (this.status.getValue() !== expected) {
      throw new ConflictException(
        `Cannot ${action} while purchase order is in status ${this.status.getValue()}`,
      );
    }
  }
}
