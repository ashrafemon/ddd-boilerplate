import { GrnNumber } from './grn-number.vo';

describe('GrnNumber', () => {
  it('trims a valid number', () => {
    expect(GrnNumber.create('  GRN-00000001  ').value).toBe('GRN-00000001');
  });

  it('rejects an invalid format', () => {
    expect(() => GrnNumber.create('nope')).toThrow('GRN number must match GRN-<identifier>');
  });

  it('compares equal numbers', () => {
    expect(GrnNumber.create('GRN-1').equals(GrnNumber.create('GRN-1'))).toBe(true);
  });
});
