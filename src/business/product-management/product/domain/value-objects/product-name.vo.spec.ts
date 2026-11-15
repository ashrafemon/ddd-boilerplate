import { ProductName } from './product-name.vo';

describe('ProductName', () => {
  it('trims the input', () => {
    expect(ProductName.create('  Wireless Mouse  ').value).toBe('Wireless Mouse');
  });

  it('compares equal names', () => {
    expect(ProductName.create('Mouse').equals(ProductName.create('Mouse'))).toBe(true);
  });
});
