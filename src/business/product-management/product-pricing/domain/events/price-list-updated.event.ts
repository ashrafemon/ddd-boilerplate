import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { PriceListId } from '../value-objects/price-list-id.vo';

export class PriceListUpdated extends DomainEvent {
  constructor(
    public readonly priceListId: PriceListId,
    public readonly name: string | null,
    public readonly code: string | null,
    public readonly currency: string | null,
    public readonly effectiveFrom: Date | null,
    public readonly effectiveTo: Date | null,
  ) {
    super();
  }
}
