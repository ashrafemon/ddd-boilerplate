import { GrnNumberInvariants } from './grn-number.invariants';

describe('GrnNumberInvariants', () => {
  it('accepts a valid GRN number', () => {
    expect(() => GrnNumberInvariants.enforceGrnNumberFormat('GRN-00000001')).not.toThrow();
  });

  it('rejects an empty number', () => {
    expect(() => GrnNumberInvariants.enforceGrnNumberFormat('   ')).toThrow(
      'GRN number is required',
    );
  });

  it('rejects a missing GRN- prefix', () => {
    expect(() => GrnNumberInvariants.enforceGrnNumberFormat('1000001')).toThrow(
      'GRN number must match GRN-<identifier>',
    );
  });

  it('rejects lowercase prefixes', () => {
    expect(() => GrnNumberInvariants.enforceGrnNumberFormat('grn-00000001')).toThrow(
      'GRN number must match GRN-<identifier>',
    );
  });
});
