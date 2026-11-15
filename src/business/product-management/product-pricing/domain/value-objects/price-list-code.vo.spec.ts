import { PriceListCode } from './price-list-code.vo';

describe('PriceListCode', () => {
  it('trims and upper-cases the code', () => {
    expect(PriceListCode.create('  list-1  ').value).toBe('LIST-1');
  });

  it('rejects an empty code', () => {
    expect(() => PriceListCode.create('   ')).toThrow('Price list code is required');
  });

  it('rejects a nullish code', () => {
    expect(() => PriceListCode.create(undefined as never)).toThrow('Price list code is required');
  });

  it('stringifies and compares', () => {
    expect(PriceListCode.create('L1').toString()).toBe('L1');
    expect(PriceListCode.create('L1').equals(PriceListCode.create('l1'))).toBe(true);
    expect(PriceListCode.create('L1').equals(undefined)).toBe(false);
  });
});
