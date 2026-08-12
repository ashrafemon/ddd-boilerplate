import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { Money } from '@business/shared-business/domain/money.value-object';
import { domainEventRegistry } from '@business/shared-business/domain/events/domain-event.registry';
import { ProductId } from '../value-objects/product-id.vo';

export class ProductCreated extends DomainEvent {
  constructor(
    public readonly productId: ProductId,
    public readonly sku: string,
    public readonly name: string,
    public readonly unitPrice: Money,
    public readonly currency: string,
  ) {
    super();
  }
}

export class ProductUpdated extends DomainEvent {
  constructor(public readonly productId: ProductId) {
    super();
  }
}

export class ProductActivated extends DomainEvent {
  constructor(public readonly productId: ProductId) {
    super();
  }
}

export class ProductDeactivated extends DomainEvent {
  constructor(public readonly productId: ProductId) {
    super();
  }
}

export class ProductDiscontinued extends DomainEvent {
  constructor(public readonly productId: ProductId) {
    super();
  }
}

domainEventRegistry.register('ProductCreated', payload => {
  const p = payload as unknown as {
    productId: { value: string };
    sku: string;
    name: string;
    unitPrice: { minorUnits: number; currency: string };
    currency: string;
  };
  return new ProductCreated(
    ProductId.fromString(p.productId.value),
    p.sku,
    p.name,
    Money.fromMinorUnits(p.unitPrice.minorUnits, p.unitPrice.currency),
    p.currency,
  );
});

domainEventRegistry.register('ProductUpdated', payload => {
  const p = payload as unknown as { productId: { value: string } };
  return new ProductUpdated(ProductId.fromString(p.productId.value));
});

domainEventRegistry.register('ProductActivated', payload => {
  const p = payload as unknown as { productId: { value: string } };
  return new ProductActivated(ProductId.fromString(p.productId.value));
});

domainEventRegistry.register('ProductDeactivated', payload => {
  const p = payload as unknown as { productId: { value: string } };
  return new ProductDeactivated(ProductId.fromString(p.productId.value));
});

domainEventRegistry.register('ProductDiscontinued', payload => {
  const p = payload as unknown as { productId: { value: string } };
  return new ProductDiscontinued(ProductId.fromString(p.productId.value));
});
