import { ProductReference } from '../../public/contracts/product-for-sales.contract';

describe('ProductReference (sales) contract', () => {
  it('exposes sales fields including tenant scope', () => {
    const reference: ProductReference = {
      id: 'p-1',
      sku: 'SKU-1',
      name: 'Mouse',
      status: 'ACTIVE',
      companyId: 'company-1',
      tenantId: 'tenant-1',
    };
    expect(reference).toMatchObject({
      sku: 'SKU-1',
      companyId: 'company-1',
      tenantId: 'tenant-1',
    });
  });
});
