import fc from 'fast-check';
import { GrnInvariants } from '@business/procurement/purchase-goods-receipt/domain/aggregates/grn.invariants';

/**
 * Goods receipt note — property tests (fast-check).
 *
 * Receiving rules are quantity/state machines: an over-receipt must never be
 * accepted, and a terminal GRN must never move again. Both are checked over the
 * whole generated input space.
 */

const RUNS = { numRuns: 200 } as const;

const STATUSES = ['DRAFT', 'RECEIVED', 'COMPLETED', 'CANCELLED', 'REVERSED'] as const;

const TERMINAL = ['CANCELLED', 'REVERSED'] as const;

const ALLOWED: Record<(typeof STATUSES)[number], (typeof STATUSES)[number][]> = {
  DRAFT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['REVERSED'],
  CANCELLED: [],
  REVERSED: [],
};

describe('GRN properties', () => {
  it('accepts received <= expected and rejects any over-receipt', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (expected, received) => {
          const call = () => GrnInvariants.enforceGrnInspectionBalance(expected, received);
          if (received <= expected) expect(call).not.toThrow();
          else expect(call).toThrow();
        },
      ),
      RUNS,
    );
  });

  it('matches the documented transition matrix exactly', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATUSES), fc.constantFrom(...STATUSES), (from, to) => {
        const call = () => GrnInvariants.enforceGrnStatusTransition(from, to);
        if (from === to) {
          expect(call).not.toThrow();
          return;
        }
        if (ALLOWED[from].includes(to)) expect(call).not.toThrow();
        else expect(call).toThrow();
      }),
      RUNS,
    );
  });

  it('a terminal GRN accepts no outgoing transition', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TERMINAL), fc.constantFrom(...STATUSES), (from, to) => {
        if (from === to) return;
        expect(() => GrnInvariants.enforceGrnStatusTransition(from, to)).toThrow();
      }),
      RUNS,
    );
  });

  it('only a COMPLETED GRN is reversible', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATUSES), status => {
        const call = () => GrnInvariants.enforceGrnReversible(status);
        if (status === 'COMPLETED') expect(call).not.toThrow();
        else expect(call).toThrow();
      }),
      RUNS,
    );
  });

  it('reversal requires a reversalOfId', () => {
    fc.assert(
      fc.property(fc.constant(''), reversalOfId => {
        expect(() => GrnInvariants.enforceGrnReversal(reversalOfId)).toThrow();
      }),
      RUNS,
    );
    fc.assert(
      fc.property(fc.uuid(), reversalOfId => {
        expect(() => GrnInvariants.enforceGrnReversal(reversalOfId)).not.toThrow();
      }),
      RUNS,
    );
  });

  it('only DRAFT GRNs are editable', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATUSES), status => {
        const call = () => GrnInvariants.enforceGrnEditable(status);
        if (status === 'DRAFT') expect(call).not.toThrow();
        else expect(call).toThrow();
      }),
      RUNS,
    );
  });

  it('a GRN needs at least one line and a purchase order id', () => {
    fc.assert(
      fc.property(fc.integer({ max: 0 }), lineCount => {
        expect(() => GrnInvariants.enforceGrnHasLines(lineCount)).toThrow();
      }),
      RUNS,
    );
    fc.assert(
      fc.property(fc.stringMatching(/^[ \t]{0,10}$/), purchaseOrderId => {
        expect(() => GrnInvariants.enforceGrnCreate(purchaseOrderId)).toThrow();
      }),
      RUNS,
    );
  });
});
