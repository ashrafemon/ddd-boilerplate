import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { GoodReceiptNote } from '../aggregates/grn.aggregate';
import { GrnLine, GrnProps, GrnStatus } from '../types/grn.types';
import { CreateGrnInput } from '../types/grn.types';
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
        id: GrnId.generate(),
        grnNumber: `GRN-${Date.now()}`,
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
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
      } satisfies GrnProps,
      1,
    );

    grn.addEvent(new GrnCreated(grn.id, grn.grnNumber, input.purchaseOrderId));
    return grn;
  }

  static reconstitute(id: GrnId, props: GrnProps, version: number): GoodReceiptNote {
    return GoodReceiptNote.instantiate(id, props, version);
  }
}
