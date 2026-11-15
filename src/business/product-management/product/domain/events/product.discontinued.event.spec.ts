import { ProductDiscontinued } from './product.discontinued.event';
import { ProductId } from '../value-objects/product-id.vo';

describe('ProductDiscontinued', () => {
  it('carries the product id', () => {
    const event = new ProductDiscontinued(ProductId.fromString('product-1'));
    expect(event.productId.value).toBe('product-1');
    expect(event.eventId).toBeTruthy();
  });
});
