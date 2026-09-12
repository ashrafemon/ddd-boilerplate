import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { domainEventRegistry } from '@business/shared-business/domain/registries/domain-event.registry';
import { ProductId } from '../value-objects/product-id.vo';
import { ProductCreated } from './product.created.event';
import { ProductUpdated } from './product.updated.event';
import { ProductActivated } from './product.activated.event';
import { ProductDeactivated } from './product.deactivated.event';
import { ProductDiscontinued } from './product.discontinued.event';

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
