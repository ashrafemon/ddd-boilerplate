import { ProductActivated } from './product.activated.event';
import { ProductId } from '../value-objects/product-id.vo';

describe('ProductActivated', () => {
  it('carries the product id', () => {
    const event = new ProductActivated(ProductId.fromString('product-1'));
    expect(event.productId.value).toBe('product-1');
    expect(event.eventId).toBeTruthy();
  });
});
