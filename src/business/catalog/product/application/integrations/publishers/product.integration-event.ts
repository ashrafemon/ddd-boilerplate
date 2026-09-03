import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { ProductId } from '../../../domain/value-objects/product-id.vo';

export class ProductCreatedIntegrationEvent extends DomainEvent {
  constructor(
    public readonly productId: ProductId,
    public readonly sku: string,
    public readonly name: string,
    public readonly unitPrice: number,
    public readonly currency: string,
  ) {
    super();
  }
}

export class ProductUpdatedIntegrationEvent extends DomainEvent {
  constructor(
    public readonly productId: ProductId,
    public readonly name: string,
    public readonly description: string | null,
  ) {
    super();
  }
}

export class ProductActivatedIntegrationEvent extends DomainEvent {
  constructor(public readonly productId: ProductId) {
    super();
  }
}

export class ProductDeactivatedIntegrationEvent extends DomainEvent {
  constructor(public readonly productId: ProductId) {
    super();
  }
}

export class ProductDiscontinuedIntegrationEvent extends DomainEvent {
  constructor(public readonly productId: ProductId) {
    super();
  }
}