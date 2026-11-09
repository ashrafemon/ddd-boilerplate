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

export class PriceListActivated extends DomainEvent {
  constructor(public readonly priceListId: PriceListId) {
    super();
  }
}

export class PriceListDeactivated extends DomainEvent {
  constructor(public readonly priceListId: PriceListId) {
    super();
  }
}

export class PriceListArchived extends DomainEvent {
  constructor(public readonly priceListId: PriceListId) {
    super();
  }
}

export class PriceListLineAdded extends DomainEvent {
  constructor(
    public readonly priceListId: PriceListId,
    public readonly productId: string,
  ) {
    super();
  }
}

export class PriceListLineUpdated extends DomainEvent {
  constructor(
    public readonly priceListId: PriceListId,
    public readonly productId: string,
  ) {
    super();
  }
}

export class PriceListLineRemoved extends DomainEvent {
  constructor(
    public readonly priceListId: PriceListId,
    public readonly productId: string,
  ) {
    super();
  }
}
