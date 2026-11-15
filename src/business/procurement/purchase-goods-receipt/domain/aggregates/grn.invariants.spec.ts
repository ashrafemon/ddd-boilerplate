import { GrnInvariants } from './grn.invariants';

describe('GrnInvariants', () => {
  describe('enforceGrnCreate', () => {
    it('throws when purchaseOrderId is blank', () => {
      expect(() => GrnInvariants.enforceGrnCreate('')).toThrow('Purchase order ID is required');
    });

    it('passes with valid purchaseOrderId', () => {
      expect(() => GrnInvariants.enforceGrnCreate('po-1')).not.toThrow();
    });
  });

  describe('enforceGrnHasLines', () => {
    it('throws when no lines', () => {
      expect(() => GrnInvariants.enforceGrnHasLines(0)).toThrow('GRN must have at least one line');
    });

    it('passes with at least one line', () => {
      expect(() => GrnInvariants.enforceGrnHasLines(1)).not.toThrow();
    });
  });

  describe('enforceGrnReversal', () => {
    it('throws when reversalOfId is empty', () => {
      expect(() => GrnInvariants.enforceGrnReversal('')).toThrow('Reversal requires reversalOfId');
    });

    it('passes with reversalOfId', () => {
      expect(() => GrnInvariants.enforceGrnReversal('original-grn-id')).not.toThrow();
    });
  });

  describe('enforceGrnEditable', () => {
    it('passes for DRAFT', () => {
      expect(() => GrnInvariants.enforceGrnEditable('DRAFT')).not.toThrow();
    });

    it('throws for non-DRAFT', () => {
      expect(() => GrnInvariants.enforceGrnEditable('RECEIVED')).toThrow(
        'Only draft GRNs can be edited',
      );
    });
  });

  describe('enforceGrnInspectionBalance', () => {
    it('throws when received exceeds expected', () => {
      expect(() => GrnInvariants.enforceGrnInspectionBalance(10, 11)).toThrow(
        'Received quantity exceeds expected quantity',
      );
    });

    it('passes when received equals expected', () => {
      expect(() => GrnInvariants.enforceGrnInspectionBalance(10, 10)).not.toThrow();
    });

    it('passes when received less than expected', () => {
      expect(() => GrnInvariants.enforceGrnInspectionBalance(10, 5)).not.toThrow();
    });
  });
});
