import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

/**
 * A controlled amendment of an ISSUED purchase order (spec §4
 * "AmendPurchaseOrder", §8). Carries the fields that actually changed, the
 * mandatory reason, and the actor — so a consumer can tell what moved
 * without re-reading the order.
 */
export class PurchaseOrderAmended extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: string,
    public readonly changes: Record<string, unknown>,
    public readonly reason: string,
    public readonly actorId?: string,
  ) {
    super();
  }
}
