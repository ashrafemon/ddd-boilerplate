import { Sku } from './sku.vo';

describe('Sku', () => {
  it('trims and upper-cases the input', () => {
    expect(Sku.create('  sku-001  ').value).toBe('SKU-001');
  });

  it('compares equal SKUs', () => {
    expect(Sku.create('SKU-1').equals(Sku.create('sku-1'))).toBe(true);
  });
});
