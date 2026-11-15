import { InvoicePolicy } from './invoice.policy';
import { InvoiceStatus } from '../types/invoice.enum';

describe('InvoicePolicy', () => {
  describe('enforceInvoicePostAllowed', () => {
    it('passes for DRAFT with lines', () => {
      expect(() => InvoicePolicy.enforceInvoicePostAllowed(InvoiceStatus.DRAFT, 2)).not.toThrow();
    });

    it('throws when no lines', () => {
      expect(() => InvoicePolicy.enforceInvoicePostAllowed(InvoiceStatus.DRAFT, 0)).toThrow(
        'Invoice must have at least one line to post',
      );
    });

    it('throws for non-DRAFT', () => {
      expect(() => InvoicePolicy.enforceInvoicePostAllowed(InvoiceStatus.POSTED, 1)).toThrow(
        'Cannot post invoice in status POSTED',
      );
    });
  });

  describe('enforceInvoiceCancelAllowed', () => {
    it('passes for DRAFT', () => {
      expect(() => InvoicePolicy.enforceInvoiceCancelAllowed(InvoiceStatus.DRAFT)).not.toThrow();
    });

    it('throws for POSTED', () => {
      expect(() => InvoicePolicy.enforceInvoiceCancelAllowed(InvoiceStatus.POSTED)).toThrow(
        'Cannot cancel a posted invoice',
      );
    });

    it('throws for already CANCELLED', () => {
      expect(() => InvoicePolicy.enforceInvoiceCancelAllowed(InvoiceStatus.CANCELLED)).toThrow(
        'Invoice is already cancelled',
      );
    });
  });
});
