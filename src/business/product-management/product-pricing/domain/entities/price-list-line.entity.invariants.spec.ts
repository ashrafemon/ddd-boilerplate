import { PriceListLineInvariants } from './price-list-line.entity.invariants';

describe('PriceListLineInvariants', () => {
  it('accepts a zero price', () => {
    expect(() => PriceListLineInvariants.enforcePriceListLineCreatePrice(0)).not.toThrow();
  });

  it('rejects a negative price', () => {
    expect(() => PriceListLineInvariants.enforcePriceListLineCreatePrice(-5)).toThrow(
      'Price list line price cannot be negative',
    );
  });

  it('accepts min >= 1', () => {
    expect(() =>
      PriceListLineInvariants.enforcePriceListLineCreateQuantityRange(1, null),
    ).not.toThrow();
  });

  it('rejects min < 1', () => {
    expect(() => PriceListLineInvariants.enforcePriceListLineCreateQuantityRange(0, null)).toThrow(
      'Price list line minimum quantity must be >= 1',
    );
  });

  it('rejects max < min', () => {
    expect(() => PriceListLineInvariants.enforcePriceListLineCreateQuantityRange(10, 5)).toThrow(
      'Price list line maximum quantity must be >= minimum quantity',
    );
  });
});
