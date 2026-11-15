import { Quantity } from './quantity';

describe('Quantity', () => {
  describe('construction', () => {
    it('creates a valid quantity', () => {
      const qty = Quantity.of(5, 'EA');
      expect(qty.value).toBe(5);
      expect(qty.uomId).toBe('EA');
    });

    it('accepts zero', () => {
      expect(Quantity.of(0, 'KG').value).toBe(0);
    });

    it('rejects negative values', () => {
      expect(() => Quantity.of(-1, 'EA')).toThrow('Quantity must be a non-negative finite number');
    });

    it('rejects non-finite values', () => {
      expect(() => Quantity.of(Number.NaN, 'EA')).toThrow(
        'Quantity must be a non-negative finite number',
      );
      expect(() => Quantity.of(Infinity, 'EA')).toThrow(
        'Quantity must be a non-negative finite number',
      );
    });
  });

  describe('add', () => {
    it('adds same-UOM quantities', () => {
      expect(Quantity.of(2, 'EA').add(Quantity.of(3, 'EA')).value).toBe(5);
    });

    it('rejects UOM mismatch', () => {
      expect(() => Quantity.of(2, 'EA').add(Quantity.of(3, 'KG'))).toThrow('UOM mismatch');
    });
  });

  describe('subtract', () => {
    it('subtracts same-UOM quantities', () => {
      expect(Quantity.of(5, 'EA').subtract(Quantity.of(2, 'EA')).value).toBe(3);
    });

    it('rejects UOM mismatch', () => {
      expect(() => Quantity.of(5, 'EA').subtract(Quantity.of(2, 'KG'))).toThrow('UOM mismatch');
    });

    it('rejects a negative result', () => {
      expect(() => Quantity.of(2, 'EA').subtract(Quantity.of(5, 'EA'))).toThrow(
        'Quantity cannot be negative',
      );
    });
  });

  describe('multiply', () => {
    it('multiplies the value', () => {
      expect(Quantity.of(3, 'EA').multiply(4).value).toBe(12);
    });

    it('preserves the UOM', () => {
      expect(Quantity.of(3, 'KG').multiply(2).uomId).toBe('KG');
    });
  });

  describe('predicates', () => {
    it('compares magnitudes', () => {
      expect(Quantity.of(5, 'EA').isGreaterThan(Quantity.of(2, 'EA'))).toBe(true);
      expect(Quantity.of(2, 'EA').isGreaterThan(Quantity.of(5, 'EA'))).toBe(false);
      expect(Quantity.of(5, 'EA').isGreaterThan(Quantity.of(5, 'EA'))).toBe(false);
    });

    it('compares equality including UOM', () => {
      expect(Quantity.of(5, 'EA').equals(Quantity.of(5, 'EA'))).toBe(true);
      expect(Quantity.of(5, 'EA').equals(Quantity.of(5, 'KG'))).toBe(false);
      expect(Quantity.of(5, 'EA').equals(undefined)).toBe(false);
    });
  });
});
