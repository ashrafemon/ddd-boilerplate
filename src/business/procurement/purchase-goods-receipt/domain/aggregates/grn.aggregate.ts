import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { GrnInvariants } from './grn.invariants';
import { enforceGrnLineQuantity } from '../entities/grn-line.entity.invariants';
import { GrnId } from '../value-objects/grn-id.vo';
import { GrnLine, GrnProps, GrnStatus, TrackingEntry } from '../types/grn.types';
import { GrnTotalsService } from '../services/grn-totals.service';
import { GrnCompleted } from '../events/grn.completed.event';
import { GoodsReceiptPosted } from '../events/grn.posted.event';
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

  get receivedAt(): Date | null {
    return this.props.receivedAt;
  }

  /** Original posted GRN this document compensates (null for originals). */
  get reversalOfId(): string | null {
    return this.props.reversalOfId ?? null;
  }

  get createdBy(): string | null {
    return this.props.createdBy ?? null;
  }

  get receivedBy(): string | null {
    return this.props.receivedBy ?? null;
  }

  get postedBy(): string | null {
    return this.props.postedBy ?? null;
  }

  get cancelledBy(): string | null {
    return this.props.cancelledBy ?? null;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  private assertEditable(): void {
    GrnInvariants.enforceGrnEditable(this.props.status);
  }

  addLine(
    productId: string,
    orderedQuantity: number,
    receivedQuantity: number,
    unitPrice: number,
  ): void {
    this.assertEditable();
    GrnLineInvariants.enforceGrnLineQuantity(receivedQuantity);

    const existing = this.props.lines.find(line => line.productId === productId);
    if (existing) {
      const newReceivedQty = existing.receivedQuantity + receivedQuantity;
      this.props.lines = this.props.lines.map(line =>
        line.productId === productId ? line.withReceivedQuantity(newReceivedQty) : line,
      );
    } else {
      this.props.lines.push(
        GrnLine.create(productId, orderedQuantity, receivedQuantity, unitPrice),
      );
    }
    this.props.updatedAt = new Date();
    this.addEvent(new GrnLineAdded(this.id, productId));
  }

  receive(actorId?: string): void {
    GrnInvariants.enforceGrnHasLines(this.props.lines.length);
    GrnInvariants.enforceGrnStatusTransition(this.props.status, GrnStatus.RECEIVED);
    this.props.status = GrnStatus.RECEIVED;
    this.props.receivedAt = new Date();
    this.props.receivedBy = actorId ?? null;
    this.props.updatedAt = new Date();
    this.addEvent(new GrnReceived(this.id));
  }

  /**
   * Post/complete transition. `actorId` is the poster (plan §1.2 `postedBy`);
   * the legacy `PATCH /grn/:id/complete` path passes none and leaves it null.
   */
  complete(actorId?: string): void {
    GrnInvariants.enforceGrnStatusTransition(this.props.status, GrnStatus.COMPLETED);
    this.props.status = GrnStatus.COMPLETED;
    this.props.postedBy = actorId ?? null;
    this.props.updatedAt = new Date();
    this.addEvent(new GrnCompleted(this.id));
    this.addEvent(
      new GoodsReceiptPosted(
        this.id.toString(),
        this.props.purchaseOrderId,
        this.props.lines.map(l => ({
          grnLineId: `${this.id.toString()}:${l.productId}`,
          productId: l.productId,
          acceptedQuantity: l.acceptedQuantity > 0 ? l.acceptedQuantity : l.receivedQuantity,
          unitPrice: l.unitPrice,
        })),
      ),
    );
  }

  cancel(actorId?: string): void {
    GrnInvariants.enforceGrnStatusTransition(this.props.status, GrnStatus.CANCELLED);
    this.props.status = GrnStatus.CANCELLED;
    this.props.cancelledBy = actorId ?? null;
    this.props.updatedAt = new Date();
    this.addEvent(new GrnCancelled(this.id));
  }

  /**
   * Accepted/rejected split (plan Phase 3.2, invariant GRN-01/02): only on a
   * RECEIVED document (inspection happens after receipt, before post);
   * `received = accepted + rejected` is enforced per line — the same physical
   * quantity can never be dispositioned twice.
   */
  recordInspectionResult(input: {
    lines: { productId: string; acceptedQuantity: number; rejectedQuantity: number }[];
  }): void {
    if (this.props.status !== 'RECEIVED') {
      throw Object.assign(
        new Error(
          `Inspection can only be recorded on a RECEIVED GRN (status: ${this.props.status})`,
        ),
        { statusCode: 422 },
      );
    }

    for (const result of input.lines) {
      const line = this.props.lines.find(l => l.productId === result.productId);
      if (!line) {
        throw Object.assign(new Error(`Product ${result.productId} is not on this GRN`), {
          statusCode: 422,
        });
      }
      GrnInvariants.enforceGrnInspectionBalance(
        line.receivedQuantity,
        result.acceptedQuantity + result.rejectedQuantity,
      );
      this.props.lines = this.props.lines.map(l =>
        l.productId === result.productId
          ? l.withInspection(result.acceptedQuantity, result.rejectedQuantity)
          : l,
      );
    }
    this.props.updatedAt = new Date();
  }

  setLineTracking(productId: string, entries: TrackingEntry[]): void {
    this.props.lines = this.props.lines.map(line =>
      line.productId === productId ? line.withTracking(entries) : line,
    );
    this.props.updatedAt = new Date();
  }

  get subtotal(): number {
    return GrnTotalsService.subtotal(this.props.lines);
  }

  get total(): number {
    return this.subtotal;
  }
}
