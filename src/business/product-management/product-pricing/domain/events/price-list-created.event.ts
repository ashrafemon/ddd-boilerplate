import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { PriceListId } from '../value-objects/price-list-id.vo';

export class PriceListCreated extends DomainEvent {
  constructor(
    public readonly priceListId: PriceListId,
    public readonly name: string,
    public readonly code: string,
    public readonly currency: string,
  ) {
    super();
  }
}
