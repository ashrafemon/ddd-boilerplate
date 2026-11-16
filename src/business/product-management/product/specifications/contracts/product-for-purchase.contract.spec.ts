import { ProductReference } from '../../public/contracts/product-for-purchase.contract';

describe('ProductReference (purchase) contract', () => {
  it('exposes purchasing fields', () => {
    const reference: ProductReference = {
      id: 'p-1',
      sku: 'SKU-1',
      name: 'Mouse',
      description: null,
      status: 'ACTIVE',
      unitPrice: 9.99,
      currency: 'USD',
    };
    expect(reference).toMatchObject({ sku: 'SKU-1', unitPrice: 9.99, currency: 'USD' });
  });
});
