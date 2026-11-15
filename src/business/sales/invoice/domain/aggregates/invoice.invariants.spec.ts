import { InvoiceInvariants } from './invoice.invariants';
import { InvoiceStatus } from '../types/invoice.enum';

describe('InvoiceInvariants', () => {
  describe('enforceInvoiceCreate', () => {
    it('throws when no lines', () => {
      expect(() => InvoiceInvariants.enforceInvoiceCreate(0)).toThrow(
        'Invoice must have at least one line',
      );
    });

    it('passes with at least one line', () => {
      expect(() => InvoiceInvariants.enforceInvoiceCreate(1)).not.toThrow();
    });
  });

  describe('enforceInvoiceLine', () => {
    it('throws for non-positive quantity', () => {
      expect(() => InvoiceInvariants.enforceInvoiceLine(0, 100)).toThrow(
        'Invoice line quantity must be positive',
      );
    });

    it('throws for NaN quantity', () => {
      expect(() => InvoiceInvariants.enforceInvoiceLine(NaN, 100)).toThrow(
        'Invoice line quantity must be positive',
      );
    });

    it('throws for negative unitPriceMinor', () => {
      expect(() => InvoiceInvariants.enforceInvoiceLine(1, -1)).toThrow(
        'Invoice line price cannot be negative',
      );
    });

    it('passes for valid quantity and price', () => {
      expect(() => InvoiceInvariants.enforceInvoiceLine(2, 500)).not.toThrow();
    });
  });

  describe('enforceInvoiceStatusTransition', () => {
    it('allows DRAFT -> POSTED', () => {
      expect(() =>
        InvoiceInvariants.enforceInvoiceStatusTransition(InvoiceStatus.DRAFT, InvoiceStatus.POSTED),
      ).not.toThrow();
    });

    it('allows DRAFT -> CANCELLED', () => {
      expect(() =>
        InvoiceInvariants.enforceInvoiceStatusTransition(
          InvoiceStatus.DRAFT,
          InvoiceStatus.CANCELLED,
        ),
      ).not.toThrow();
    });

    it('allows POSTED -> CANCELLED', () => {
      expect(() =>
        InvoiceInvariants.enforceInvoiceStatusTransition(
          InvoiceStatus.POSTED,
          InvoiceStatus.CANCELLED,
        ),
      ).not.toThrow();
    });

    it('rejects CANCELLED -> anything', () => {
      expect(() =>
        InvoiceInvariants.enforceInvoiceStatusTransition(
          InvoiceStatus.CANCELLED,
          InvoiceStatus.POSTED,
        ),
      ).toThrow('Cannot transition invoice');
    });

    it('allows no-op transition', () => {
      expect(() =>
        InvoiceInvariants.enforceInvoiceStatusTransition(InvoiceStatus.DRAFT, InvoiceStatus.DRAFT),
      ).not.toThrow();
    });
  });
});
