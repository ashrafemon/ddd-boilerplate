import fc from 'fast-check';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { InvoiceFactory } from '@business/sales/invoice/domain/factories/invoice.factory';
import { InvoiceInvariants } from '@business/sales/invoice/domain/aggregates/invoice.invariants';
import { InvoiceLine } from '@business/sales/invoice/domain/value-objects/invoice-line.vo';
import { InvoiceStatus } from '@business/sales/invoice/domain/types/invoice.enum';

/**
 * Invoice — property tests (fast-check).
 *
 * Invoice totals must equal the sum of their lines exactly, in minor units, for
 * any number of generated lines; posting must be idempotent so a retried
 * command cannot emit a second event.
 */

const RUNS = { numRuns: 200 } as const;

const lineArb = fc.record({
  description: fc.string({ minLength: 1, maxLength: 40 }).filter(value => value.trim().length > 0),
  quantity: fc.integer({ min: 1, max: 1_000 }),
  unitPrice: fc.double({ min: 0, max: 10_000, noNaN: true }),
});

const invoiceNo = fc.stringMatching(/^[A-Z0-9]{1,20}$/).map(suffix => `INV-${suffix}`);

describe('Invoice properties', () => {
  it('a line total is exactly unit price times quantity', () => {
    fc.assert(
      fc.property(lineArb, line => {
        const unitPrice = Money.fromDecimal(line.unitPrice, 'USD');
        const created = InvoiceLine.create(line.description, line.quantity, unitPrice);
        expect(created.total().minorUnits).toBe(unitPrice.minorUnits * line.quantity);
        expect(created.total().minorUnits).toBeGreaterThanOrEqual(0);
      }),
      RUNS,
    );
  });

  it('invoice total equals the sum of its line totals, in any order', () => {
    fc.assert(
      fc.property(invoiceNo, fc.array(lineArb, { minLength: 1, maxLength: 8 }), (no, lines) => {
        const invoice = InvoiceFactory.create({
          invoiceNo: no,
          customerId: 'customer-1',
          currency: 'USD',
          lines,
        });

        const expected = invoice.lines.reduce((sum, line) => sum + line.total().minorUnits, 0);
        expect(invoice.totalAmount().minorUnits).toBe(expected);

        const reversed = [...invoice.lines].reduceRight(
          (sum, line) => sum + line.total().minorUnits,
          0,
        );
        expect(reversed).toBe(expected);
      }),
      RUNS,
    );
  });

  it('posting is idempotent: two calls emit exactly one event', () => {
    fc.assert(
      fc.property(invoiceNo, lineArb, (no, line) => {
        const invoice = InvoiceFactory.create({
          invoiceNo: no,
          customerId: 'customer-1',
          currency: 'USD',
          lines: [line],
        });

        invoice.pullEvents();
        invoice.post();
        invoice.post();

        expect(invoice.status).toBe(InvoiceStatus.POSTED);
        expect(invoice.pullEvents()).toHaveLength(1);
        expect(invoice.postedAt).not.toBeNull();
      }),
      RUNS,
    );
  });

  it('rejects non-positive line quantities', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000, max: 0 }), quantity => {
        expect(() => InvoiceInvariants.enforceInvoiceLine(quantity, 100)).toThrow();
      }),
      RUNS,
    );
  });

  it('rejects negative line prices but accepts a zero price', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: -1 }), price => {
        expect(() => InvoiceInvariants.enforceInvoiceLine(1, price)).toThrow();
      }),
      RUNS,
    );
    expect(() => InvoiceInvariants.enforceInvoiceLine(1, 0)).not.toThrow();
  });

  it('a CANCELLED invoice accepts no further transition', () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.values(InvoiceStatus)), to => {
        if (to === InvoiceStatus.CANCELLED) return;
        expect(() =>
          InvoiceInvariants.enforceInvoiceStatusTransition(InvoiceStatus.CANCELLED, to),
        ).toThrow();
      }),
      RUNS,
    );
  });

  it('an invoice always needs at least one line', () => {
    fc.assert(
      fc.property(fc.integer({ max: 0 }), lineCount => {
        expect(() => InvoiceInvariants.enforceInvoiceCreate(lineCount)).toThrow();
      }),
      RUNS,
    );
  });
});
