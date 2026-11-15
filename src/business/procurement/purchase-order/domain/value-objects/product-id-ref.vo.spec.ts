import { ProductIdRef } from './product-id-ref.vo';

describe('ProductIdRef', () => {
  it('wraps a string value', () => {
    expect(new ProductIdRef('prod-1').value).toBe('prod-1');
  });

  it('stringifies to its value', () => {
    expect(new ProductIdRef('prod-1').toString()).toBe('prod-1');
  });

  it('compares equality by value', () => {
    expect(new ProductIdRef('a').equals(new ProductIdRef('a'))).toBe(true);
    expect(new ProductIdRef('a').equals(new ProductIdRef('b'))).toBe(false);
    expect(new ProductIdRef('a').equals(undefined)).toBe(false);
  });
});
