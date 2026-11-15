import { PriceListId } from './price-list-id.vo';

describe('PriceListId', () => {
  it('wraps a string value', () => {
    expect(PriceListId.fromString('pl-1').value).toBe('pl-1');
  });

  it('generates a UUID', () => {
    expect(PriceListId.generate().value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('stringifies and compares', () => {
    expect(PriceListId.fromString('a').toString()).toBe('a');
    expect(PriceListId.fromString('a').equals(PriceListId.fromString('a'))).toBe(true);
    expect(PriceListId.fromString('a').equals(undefined)).toBe(false);
  });
});
