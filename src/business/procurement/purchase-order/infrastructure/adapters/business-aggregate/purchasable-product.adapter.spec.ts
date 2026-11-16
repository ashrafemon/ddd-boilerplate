import { PurchasableProductAdapter } from './purchasable-product.adapter';

describe('PurchaseOrder PurchasableProductAdapter', () => {
  const port = {
    getPurchasableProduct: jest.fn(),
    findPurchasableProductsBySkus: jest.fn(),
  };
  let adapter: PurchasableProductAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PurchasableProductAdapter(port);
  });

  it('delegates getPurchasableProduct', async () => {
    port.getPurchasableProduct.mockResolvedValue({ id: 'p-1' });
    await expect(adapter.getPurchasableProduct('p-1')).resolves.toEqual({ id: 'p-1' });
  });

  it('delegates findPurchasableProductsBySkus', async () => {
    port.findPurchasableProductsBySkus.mockResolvedValue([{ id: 'p-1' }]);
    await expect(adapter.findPurchasableProductsBySkus(['SKU-1'])).resolves.toEqual([
      { id: 'p-1' },
    ]);
  });
});
