import fc from 'fast-check';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrderInvariants } from '@business/procurement/purchase-order/domain/aggregates/purchase-order.invariants';
import { PurchaseOrderPricingService } from '@business/procurement/purchase-order/domain/services/purchase-order-pricing.service';
import { PurchaseOrderStatus } from '@business/procurement/purchase-order/domain/types/purchase-order.enum';

/**
 * Purchase order — property tests (fast-check).
 *
 * Line quantities and money arithmetic carry the commercial risk: a rounding
 * drift or an accepted non-integer quantity is a real defect, so the rules are
 * checked over generated inputs instead of three examples.
 */

const RUNS = { numRuns: 200 } as const;

const positiveQuantity = fc.integer({ min: 1, max: 100_000 });
const unitPriceMinor = fc.integer({ min: 0, max: 10_000_000 });

const TERMINAL: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.REJECTED,
  PurchaseOrderStatus.CANCELLED,
  PurchaseOrderStatus.COMPLETED,
  PurchaseOrderStatus.CLOSED,
  PurchaseOrderStatus.ARCHIVED,
];

describe('Purchase order properties', () => {
  it('accepts every positive integer quantity', () => {
    fc.assert(
      fc.property(positiveQuantity, quantity => {
        expect(() =>
          PurchaseOrderInvariants.enforcePurchaseOrderLineQuantity(quantity),
        ).not.toThrow();
      }),
      RUNS,
    );
  });

  it('rejects zero, negative and non-integer quantities', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -100_000, max: 0 }),
          fc.double({ min: 0.0001, max: 100_000, noNaN: true }).filter(n => !Number.isInteger(n)),
        ),
        quantity => {
          expect(() =>
            PurchaseOrderInvariants.enforcePurchaseOrderLineQuantity(quantity),
          ).toThrow();
        },
      ),
      RUNS,
    );
  });

  it('line total is exactly unit price times quantity in minor units', () => {
    fc.assert(
      fc.property(unitPriceMinor, positiveQuantity, (minor, quantity) => {
        const unitPrice = Money.fromMinorUnits(minor, 'USD');
        expect(PurchaseOrderPricingService.lineTotal(unitPrice, quantity).minorUnits).toBe(
          minor * quantity,
        );
      }),
      RUNS,
    );
  });

  it('money multiplication distributes over quantity: price*(a+b) === price*a + price*b', () => {
    fc.assert(
      fc.property(unitPriceMinor, positiveQuantity, positiveQuantity, (minor, a, b) => {
        const unitPrice = Money.fromMinorUnits(minor, 'USD');
        const combined = PurchaseOrderPricingService.lineTotal(unitPrice, a + b);
        const split = PurchaseOrderPricingService.lineTotal(unitPrice, a).add(
          PurchaseOrderPricingService.lineTotal(unitPrice, b),
        );
        expect(combined.equals(split)).toBe(true);
      }),
      RUNS,
    );
  });

  it('a terminal status accepts no outgoing transition', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TERMINAL),
        fc.constantFrom(...Object.values(PurchaseOrderStatus)),
        (from, to) => {
          if (from === to) return;
          expect(() =>
            PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(from, to),
          ).toThrow();
        },
      ),
      RUNS,
    );
  });

  it('every status may transition to itself (idempotent replay)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.values(PurchaseOrderStatus)), status => {
        expect(() =>
          PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(status, status),
        ).not.toThrow();
      }),
      RUNS,
    );
  });

  it('DRAFT may only move to SUBMITTED, PENDINGAPPROVAL or CANCELLED', () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.values(PurchaseOrderStatus)), to => {
        const allowed =
          to === PurchaseOrderStatus.DRAFT ||
          [
            PurchaseOrderStatus.SUBMITTED,
            PurchaseOrderStatus.PENDINGAPPROVAL,
            PurchaseOrderStatus.CANCELLED,
          ].includes(to);
        const call = () =>
          PurchaseOrderInvariants.enforcePurchaseOrderStatusTransition(
            PurchaseOrderStatus.DRAFT,
            to,
          );
        if (allowed) expect(call).not.toThrow();
        else expect(call).toThrow();
      }),
      RUNS,
    );
  });

  it('money conversion is cent-exact for every generated decimal', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1_000_000, noNaN: true }), amount => {
        const minor = PurchaseOrderPricingService.toMinorUnits(amount, 'USD');
        expect(Number.isInteger(minor)).toBe(true);
        expect(Math.abs(minor / 100 - amount)).toBeLessThanOrEqual(0.005);
      }),
      RUNS,
    );
  });
});
