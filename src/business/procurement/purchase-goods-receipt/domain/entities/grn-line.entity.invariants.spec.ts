import { GrnLineInvariants } from './grn-line.entity.invariants';

describe('GrnLineInvariants', () => {
  it('accepts a positive quantity', () => {
    expect(() => GrnLineInvariants.enforceGrnLineQuantity(3)).not.toThrow();
  });

  it('rejects zero', () => {
    expect(() => GrnLineInvariants.enforceGrnLineQuantity(0)).toThrow(
      'GRN line quantity must be positive',
    );
  });

  it('rejects a negative quantity', () => {
    expect(() => GrnLineInvariants.enforceGrnLineQuantity(-1)).toThrow(
      'GRN line quantity must be positive',
    );
  });

  it('rejects non-finite', () => {
    expect(() => GrnLineInvariants.enforceGrnLineQuantity(Number.NaN)).toThrow(
      'GRN line quantity must be positive',
    );
  });
});
