import { ProductUpdated } from './product.updated.event';
import { ProductId } from '../value-objects/product-id.vo';

describe('ProductUpdated', () => {
  it('carries the product id', () => {
    const event = new ProductUpdated(ProductId.fromString('product-1'));
    expect(event.productId.value).toBe('product-1');
    expect(event.eventId).toBeTruthy();
  });
});
