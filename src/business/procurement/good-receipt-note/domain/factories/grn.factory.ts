import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { GoodReceiptNote } from '../aggregates/grn.aggregate';
import { GrnLine, GrnProps, GrnStatus } from '../types/grn.types';
import { CreateGrnInput, CreateGrnReversalInput } from '../types/grn.types';
import { GrnId } from '../value-objects/grn.vos';
import { GrnCreated } from '../events/grn.created.event';
import './../aggregates/grn.invariants';

export class GrnFactory {
  static create(input: CreateGrnInput): GoodReceiptNote {
    invariantRegistry.enforce('grn.create', {
      purchaseOrderId: input.purchaseOrderId,
    });

    const now = new Date();
    const grn = GoodReceiptNote.instantiate(
      GrnId.generate(),
      {
        grnNumber: input.grnNumber,
        purchaseOrderId: input.purchaseOrderId,
        vendorId: input.vendorId,
        status: GrnStatus.DRAFT,
        currency: input.currency ?? 'USD',
        lines: input.lines.map(line =>
          GrnLine.create(
            line.productId,
            line.orderedQuantity,
            line.receivedQuantity,
            line.unitPrice,
          ),
        ),
        receivedAt: null,
        reversalOfId: null,
        createdBy: input.createdBy ?? null,
        receivedBy: null,
        postedBy: null,
        cancelledBy: null,
        createdAt: now,
        updatedAt: now,
      } satisfies GrnProps,
      1,
    );

    grn.addEvent(new GrnCreated(grn.id, grn.grnNumber, input.purchaseOrderId));
    return grn;
  }

  /**
   * Compensating reversal document (plan Phase 4.1 / invariant GRN-05).
   *
   * Built directly in COMPLETED (posted) state with mirrored NEGATIVE
   * quantities and a `reversalOfId` link to the original — the original rows
   * are never mutated, so receipt history is preserved exactly as posted.
   * Emits no `GrnCreated`: the use case raises `GoodsReceiptReversed` instead.
   */
  static createReversal(input: CreateGrnReversalInput): GoodReceiptNote {
    invariantRegistry.enforce('grn.reversal', { reversalOfId: input.reversalOfId });

    const now = new Date();
    const grn = GoodReceiptNote.instantiate(
      GrnId.generate(),
      {
        grnNumber: input.grnNumber,
        purchaseOrderId: input.purchaseOrderId,
        vendorId: input.vendorId,
        status: GrnStatus.COMPLETED,
        currency: input.currency,
        lines: input.lines.map(line =>
          GrnLine.create(
            line.productId,
            line.orderedQuantity,
            line.receivedQuantity,
            line.unitPrice,
            line.acceptedQuantity,
            line.rejectedQuantity,
          ),
        ),
        receivedAt: now,
        reversalOfId: input.reversalOfId,
        createdBy: input.actorId ?? null,
        receivedBy: input.actorId ?? null,
        postedBy: input.actorId ?? null,
        cancelledBy: null,
        createdAt: now,
        updatedAt: now,
      } satisfies GrnProps,
      1,
    );

    for (const line of grn.lines) {
      invariantRegistry.enforce('grn.reversal-balance', {
        receivedQuantity: line.receivedQuantity,
        acceptedQuantity: line.acceptedQuantity,
        rejectedQuantity: line.rejectedQuantity,
      });
    }
    return grn;
  }

  static reconstitute(id: GrnId, props: GrnProps, version: number): GoodReceiptNote {
    return GoodReceiptNote.instantiate(id, props, version);
  }
}
