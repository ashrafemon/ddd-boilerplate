import { DomainFactory } from '@business/shared-business/domain/bases/factory.base';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { Grn } from '../entities/grn.aggregate';
import { GrnProps } from '../types/grn.types';
import { GrnStatus } from '../types/grn.enum';
import { CreateGrnInput } from '../types/grn.types';
import { GrnId } from '../value-objects/grn.vos';
import { GrnNumber, PurchaseOrderIdRef } from '../value-objects/grn.vos';
import { GrnCreated } from '../events/grn.created.event';
import './../invariants/grn.invariants';

export class GrnFactory extends DomainFactory<Grn, CreateGrnInput> {
  create(input: CreateGrnInput): Grn {
    invariantRegistry.enforce('grn.create', {
      purchaseOrderId: input.purchaseOrderId,
    });

    const now = new Date();
    const grn = Grn.instantiate(
      GrnId.generate(),
      {
        grnNumber: `GRN-${Date.now()}`,
        purchaseOrderId: input.purchaseOrderId,
        vendorId: input.vendorId,
        status: GrnStatus.DRAFT,
        currency: input.currency ?? 'USD',
        lines: input.lines.map(line =>
          GrnLine.create(line.productId, line.orderedQuantity, line.receivedQuantity, line.unitPrice),
        ),
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      1,
    );

    grn.addEvent(
      new GrnCreated(grn.id, grn.grnNumber, input.purchaseOrderId),
    );
    return grn;
  }

  reconstitute(id: GrnId, props: GrnProps, version: number): Grn {
    return Grn.instantiate(id, props, version);
  }
}

export const grnFactory = new GrnFactory();