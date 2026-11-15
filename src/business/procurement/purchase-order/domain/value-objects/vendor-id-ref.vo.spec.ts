import { VendorIdRef } from './vendor-id-ref.vo';

describe('VendorIdRef', () => {
  it('wraps a string value', () => {
    expect(new VendorIdRef('ven-1').value).toBe('ven-1');
  });

  it('stringifies to its value', () => {
    expect(new VendorIdRef('ven-1').toString()).toBe('ven-1');
  });

  it('compares equality by value', () => {
    expect(new VendorIdRef('a').equals(new VendorIdRef('a'))).toBe(true);
    expect(new VendorIdRef('a').equals(new VendorIdRef('b'))).toBe(false);
    expect(new VendorIdRef('a').equals(undefined)).toBe(false);
  });
});
