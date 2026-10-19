import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

/**
 * `GoodsReceiptReversed` (plan Phase 4.1 / §F): the compensation has posted.
 *
 * `grnId` is the REVERSAL document, `reversalOfId` the original posted GRN it
 * compensates. Line quantities are the mirrored NEGATIVE values, so inventory
 * records compensating movements of exactly the original eligible quantity —
 * the original document rows are never touched (GRN-05).
 *
 * Class name IS the envelope `eventType` (outbox + `@OnEvent('<name>')` +
 * Rabbit routing key), so consumers address it literally — no registry.
 */
export class GoodsReceiptReversed extends DomainEvent {
  constructor(
    public readonly grnId: string,
    public readonly reversalOfId: string,
    public readonly purchaseOrderId: string,
    public readonly lines: Array<{
      grnLineId: string;
      productId: string;
      acceptedQuantity: number;
      unitPrice: number;
    }>,
  ) {
    super();
  }
}
