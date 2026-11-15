import { ReceivedQuantityInvariants } from './received-quantity.invariants';

describe('ReceivedQuantityInvariants', () => {
  it('accepts a positive quantity', () => {
    expect(() => ReceivedQuantityInvariants.enforceReceivedQuantityPositive(1)).not.toThrow();
  });

  it('rejects zero', () => {
    expect(() => ReceivedQuantityInvariants.enforceReceivedQuantityPositive(0)).toThrow(
      'Received quantity must be positive',
    );
  });

  it('rejects a negative quantity', () => {
    expect(() => ReceivedQuantityInvariants.enforceReceivedQuantityPositive(-1)).toThrow(
      'Received quantity must be positive',
    );
  });

  it('rejects NaN', () => {
    expect(() => ReceivedQuantityInvariants.enforceReceivedQuantityPositive(Number.NaN)).toThrow(
      'Received quantity must be positive',
    );
  });
});
