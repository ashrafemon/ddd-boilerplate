import fc from 'fast-check';
import { PriceListPricingService } from '@business/product-management/product-pricing/domain/services/price-list-pricing.service';
import { PriceListLineInvariants } from '@business/product-management/product-pricing/domain/entities/price-list-line.entity.invariants';
import { Money } from '@business/shared-business/domain/common/value-objects/money';

/**
 * Product pricing — property tests (fast-check).
 *
 * The price list rules that matter are numeric: price never negative, quantity
 * ranges well-formed (min >= 1, max >= min), and money arithmetic stays exact
 * to the cent through rounding.
 */

const RUNS = { numRuns: 200 } as const;

const nonNegativePrice = fc.double({ min: 0, max: 10_000, noNaN: true });
const positiveQuantity = fc.integer({ min: 1, max: 1_000_000 });
const nonNegativeQuantity = fc.integer({ min: 0, max: 1_000_000 });

describe('Price list pricing properties', () => {
  it('lineTotal is non-negative and matches round2(price * quantity)', () => {
    fc.assert(
      fc.property(nonNegativePrice, positiveQuantity, (price, quantity) => {
        const total = PriceListPricingService.lineTotal(price, quantity);
        expect(total).toBeGreaterThanOrEqual(0);
        expect(total).toBe(Math.round(price * quantity * 100) / 100);
      }),
      RUNS,
    );
  });

  it('lineTotal is monotonic in quantity', () => {
    fc.assert(
      fc.property(
        nonNegativePrice,
        positiveQuantity,
        positiveQuantity,
        positiveQuantity,
        (price, a, b, delta) => {
          const smaller = PriceListPricingService.lineTotal(
            price,
            Math.min(a, Math.min(b, b + delta)),
          );
          // Compare against the same price at a strictly larger quantity.
          expect(smaller).toBeLessThanOrEqual(
            PriceListPricingService.lineTotal(price, Math.max(a, b + delta)),
          );
        },
      ),
      RUNS,
    );
  });

  it('Money survives a decimal -> minor -> decimal round trip', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100_000, noNaN: true }), amount => {
        const money = PriceListPricingService.toMoney(amount, 'USD');
        expect(Math.abs(money.amount - amount)).toBeLessThanOrEqual(0.005);
        expect(money.toDecimal()).toMatch(/^\d+\.\d{2}$/);
        expect(Money.fromDecimal(money.toDecimal()).minorUnits).toBe(money.minorUnits);
      }),
      RUNS,
    );
  });

  it('PriceListLineInvariants accepts min >= 1 and max >= min', () => {
    fc.assert(
      fc.property(
        positiveQuantity,
        fc.option(positiveQuantity, { nil: null }),
        (minQuantity, max) => {
          if (max !== null && max < minQuantity) {
            expect(() =>
              PriceListLineInvariants.enforcePriceListLineCreateQuantityRange(minQuantity, max),
            ).toThrow();
          } else {
            expect(() =>
              PriceListLineInvariants.enforcePriceListLineCreateQuantityRange(minQuantity, max),
            ).not.toThrow();
          }
        },
      ),
      RUNS,
    );
  });

  it('PriceListLineInvariants rejects negative or non-finite minimum quantities', () => {
    fc.assert(
      fc.property(fc.oneof(fc.integer({ min: -10_000, max: 0 }), fc.constant(NaN)), minQuantity => {
        expect(() =>
          PriceListLineInvariants.enforcePriceListLineCreateQuantityRange(minQuantity, null),
        ).toThrow();
      }),
      RUNS,
    );
  });

  it('price cannot be negative', () => {
    fc.assert(
      fc.property(nonNegativePrice, price => {
        expect(() => PriceListLineInvariants.enforcePriceListLineCreatePrice(price)).not.toThrow();
      }),
      RUNS,
    );
    fc.assert(
      fc.property(fc.double({ min: -10_000, max: -0.01, noNaN: true }), price => {
        expect(() => PriceListLineInvariants.enforcePriceListLineCreatePrice(price)).toThrow();
      }),
      RUNS,
    );
  });

  it('line totals add order-independently', () => {
    fc.assert(
      fc.property(
        fc.array(nonNegativeQuantity, { minLength: 2, maxLength: 8 }),
        nonNegativePrice,
        nonNegativePrice,
        (quantities, priceA, priceB) => {
          const left = quantities.map((q, i) =>
            PriceListPricingService.lineTotal(i % 2 === 0 ? priceA : priceB, q),
          );
          const cents = (v: number) => Math.round(v * 100);
          const forward = left.reduce((acc, value) => acc + cents(value), 0);
          const backward = [...left].reverse().reduce((acc, value) => acc + cents(value), 0);
          expect(forward).toBe(backward);
        },
      ),
      RUNS,
    );
  });
});
