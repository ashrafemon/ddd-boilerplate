import { ProductId } from './product-id.vo';

describe('ProductId', () => {
  it('wraps a string value', () => {
    expect(ProductId.fromString('product-1').value).toBe('product-1');
  });

  it('generates a UUID', () => {
    expect(ProductId.generate().value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('generates unique ids', () => {
    expect(ProductId.generate().value).not.toBe(ProductId.generate().value);
  });

  it('stringifies to its value', () => {
    expect(ProductId.fromString('p').toString()).toBe('p');
  });

  it('compares equality by value', () => {
    expect(ProductId.fromString('a').equals(ProductId.fromString('a'))).toBe(true);
    expect(ProductId.fromString('a').equals(ProductId.fromString('b'))).toBe(false);
    expect(ProductId.fromString('a').equals(undefined)).toBe(false);
  });
});
