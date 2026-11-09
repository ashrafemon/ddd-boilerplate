import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { PriceListId } from '../value-objects/price-list-id.vo';

export class PriceListActivated extends DomainEvent {
  constructor(public readonly priceListId: PriceListId) {
    super();
  }
}
