import { PriceListInvariants } from './price-list.invariants';
import { PriceListStatus } from '../types/price-list.enum';

describe('PriceListInvariants', () => {
  describe('enforcePriceListCreate', () => {
    it('accepts valid input', () => {
      expect(() =>
        PriceListInvariants.enforcePriceListCreate('List', 'LIST-1', 'USD'),
      ).not.toThrow();
    });

    it('requires a name', () => {
      expect(() => PriceListInvariants.enforcePriceListCreate('', 'LIST-1', 'USD')).toThrow(
        'Price list name is required',
      );
    });

    it('requires a code', () => {
      expect(() => PriceListInvariants.enforcePriceListCreate('List', '', 'USD')).toThrow(
        'Price list code is required',
      );
    });

    it('requires a currency', () => {
      expect(() => PriceListInvariants.enforcePriceListCreate('List', 'LIST-1', '')).toThrow(
        'Price list currency is required',
      );
    });
  });

  describe('enforcePriceListStatusTransition', () => {
    it.each([
      [PriceListStatus.DRAFT, PriceListStatus.ACTIVE],
      [PriceListStatus.DRAFT, PriceListStatus.ARCHIVED],
      [PriceListStatus.ACTIVE, PriceListStatus.ARCHIVED],
    ])('allows %s -> %s', (from, to) => {
      expect(() => PriceListInvariants.enforcePriceListStatusTransition(from, to)).not.toThrow();
    });

    it('rejects ACTIVE -> DRAFT', () => {
      expect(() =>
        PriceListInvariants.enforcePriceListStatusTransition(
          PriceListStatus.ACTIVE,
          PriceListStatus.DRAFT,
        ),
      ).toThrow('Invalid price list status transition');
    });

    it('rejects ARCHIVED -> anything', () => {
      expect(() =>
        PriceListInvariants.enforcePriceListStatusTransition(
          PriceListStatus.ARCHIVED,
          PriceListStatus.ACTIVE,
        ),
      ).toThrow('Invalid price list status transition');
    });

    it('allows a no-op transition', () => {
      expect(() =>
        PriceListInvariants.enforcePriceListStatusTransition(
          PriceListStatus.DRAFT,
          PriceListStatus.DRAFT,
        ),
      ).not.toThrow();
    });
  });

  describe('enforcePriceListLinePrice', () => {
    it('accepts zero', () => {
      expect(() => PriceListInvariants.enforcePriceListLinePrice(0)).not.toThrow();
    });

    it('rejects a negative price', () => {
      expect(() => PriceListInvariants.enforcePriceListLinePrice(-1)).toThrow(
        'Price list line price cannot be negative',
      );
    });

    it('rejects a non-finite price', () => {
      expect(() => PriceListInvariants.enforcePriceListLinePrice(Number.NaN)).toThrow(
        'Price list line price cannot be negative',
      );
    });
  });

  describe('enforcePriceListLineQuantityRange', () => {
    it('accepts min >= 1 with no max', () => {
      expect(() => PriceListInvariants.enforcePriceListLineQuantityRange(1, null)).not.toThrow();
    });

    it('accepts max >= min', () => {
      expect(() => PriceListInvariants.enforcePriceListLineQuantityRange(5, 10)).not.toThrow();
    });

    it('rejects min < 1', () => {
      expect(() => PriceListInvariants.enforcePriceListLineQuantityRange(0, null)).toThrow(
        'Price list line minimum quantity must be >= 1',
      );
    });

    it('rejects max < min', () => {
      expect(() => PriceListInvariants.enforcePriceListLineQuantityRange(10, 5)).toThrow(
        'Price list line maximum quantity must be >= minimum quantity',
      );
    });
  });
});
