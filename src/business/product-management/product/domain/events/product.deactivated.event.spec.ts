import { ProductDeactivated } from './product.deactivated.event';
import { ProductId } from '../value-objects/product-id.vo';

describe('ProductDeactivated', () => {
  it('carries the product id', () => {
    const event = new ProductDeactivated(ProductId.fromString('product-1'));
    expect(event.productId.value).toBe('product-1');
    expect(event.eventId).toBeTruthy();
  });
});
