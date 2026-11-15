import { OpenQuantityService } from './open-quantity.service';

describe('OpenQuantityService', () => {
  describe('openQuantity', () => {
    it('returns the remaining quantity', () => {
      expect(OpenQuantityService.openQuantity(10, 4)).toBe(6);
    });

    it('returns zero when fully received', () => {
      expect(OpenQuantityService.openQuantity(10, 10)).toBe(0);
    });

    it('never goes negative', () => {
      expect(OpenQuantityService.openQuantity(5, 8)).toBe(0);
    });
  });

  describe('maxReceivableQuantity', () => {
    it('adds tolerance to the ordered quantity', () => {
      expect(OpenQuantityService.maxReceivableQuantity(10, 0, 0.1)).toBeCloseTo(11);
    });

    it('subtracts already received', () => {
      expect(OpenQuantityService.maxReceivableQuantity(10, 4, 0.1)).toBeCloseTo(7);
    });
  });
});
