import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { PriceListId } from '../value-objects/price-list-id.vo';

export class PriceListLineUpdated extends DomainEvent {
  constructor(
    public readonly priceListId: PriceListId,
    public readonly productId: string,
  ) {
    super();
  }
}
