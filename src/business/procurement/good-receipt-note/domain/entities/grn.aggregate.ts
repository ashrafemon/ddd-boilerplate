import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { GrnId } from '../value-objects/grn.vos';
import {
  CreateGrnInput,
  GrnLine,
  GrnProps,
  GrnStatus,
} from '../types/grn.types';
import { GrnCompleted } from '../events/grn.completed.event';
import { GrnCreated } from '../events/grn.created.event';
import { GrnLineAdded } from '../events/grn.line-added.event';
import { GrnReceived } from '../events/grn.received.event';
import { GrnCancelled } from '../events/grn.cancelled.event';

export class GoodReceiptNote extends AggregateRoot<GrnId> {
  private props: GrnProps;

  private constructor(id: GrnId, props: GrnProps, version: number) {
    super(id);
    this.props = props;
    this.version = version;
  }

  static instantiate(id: GrnId, props: GrnProps, version: number): GoodReceiptNote {
    return new GoodReceiptNote(id, props, version);
  }

  get grnNumber(): string {
    return this.props.grnNumber;
  }

  get purchaseOrderId(): string {
    return this.props.purchaseOrderId;
  }

  get vendorId(): string {
    return this.props.vendorId;
  }

  get status(): GrnStatus {
    return this.props.status as GrnStatus;
  }

  get currency(): string {
    return this.props.currency;
  }

  get lines(): readonly GrnLine[] {
    return this.props.lines;
  }

  get receivedAt(): Date {
    return this.props.receivedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  private assertEditable(): void {
    invariantRegistry.enforce('grn.editable', { status: this.props.status });
  }

  addLine(productId: string, orderedQuantity: number, receivedQuantity: number, unitPrice: number): void {
    this.assertEditable();
    invariantRegistry.enforce('grn.line-quantity', { receivedQuantity });

    const existing = this.props.lines.find(line => line.productId === productId);
    if (existing) {
      const newReceivedQty = existing.receivedQuantity + receivedQuantity;
      this.props.lines = this.props.lines.map(line =>
        line.productId === productId
          ? line.withReceivedQuantity(newReceivedQty)
          : line,
      );
    } else {
      this.props.lines.push(
        GrnLine.create(productId, orderedQuantity, receivedQuantity, unitPrice),
      );
    }
    this.props.updatedAt = new Date();
    this.addEvent(new GrnLineAdded(this.id, productId));
  }

  receive(): void {
    invariantRegistry.enforce('grn.has-lines', { lineCount: this.props.lines.length });
    invariantRegistry.enforce('grn.status-transition', {
      status: this.props.status,
      to: GrnStatus.RECEIVED,
    });
    this.props.status = GrnStatus.RECEIVED;
    this.props.receivedAt = new Date();
    this.props.updatedAt = new Date();
    this.addEvent(new GrnReceived(this.id));
  }

  complete(): void {
    invariantRegistry.enforce('grn.status-transition', {
      status: this.props.status,
      to: GrnStatus.COMPLETED,
    });
    this.props.status = GrnStatus.COMPLETED;
    this.props.updatedAt = new Date();
    this.addEvent(new GrnCompleted(this.id));
  }

  cancel(): void {
    invariantRegistry.enforce('grn.status-transition', {
      status: this.props.status,
      to: GrnStatus.CANCELLED,
    });
    this.props.status = GrnStatus.CANCELLED;
    this.props.updatedAt = new Date();
    this.addEvent(new GrnCancelled(this.id));
  }

  get subtotal(): number {
    return this.props.lines.reduce((acc, line) => acc + line.total, 0);
  }

  get total(): number {
    return this.subtotal;
  }
}