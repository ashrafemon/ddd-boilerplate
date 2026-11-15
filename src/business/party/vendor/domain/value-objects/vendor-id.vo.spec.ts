import { VendorId } from './vendor-id.vo';

describe('VendorId', () => {
  it('wraps a string value', () => {
    expect(VendorId.fromString('vendor-1').value).toBe('vendor-1');
  });

  it('generates a UUID', () => {
    const id = VendorId.generate();
    expect(id.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates unique ids', () => {
    expect(VendorId.generate().value).not.toBe(VendorId.generate().value);
  });

  it('stringifies to its value', () => {
    expect(VendorId.fromString('vendor-1').toString()).toBe('vendor-1');
  });

  it('compares equality by value', () => {
    expect(VendorId.fromString('a').equals(VendorId.fromString('a'))).toBe(true);
    expect(VendorId.fromString('a').equals(VendorId.fromString('b'))).toBe(false);
    expect(VendorId.fromString('a').equals(undefined)).toBe(false);
  });
});
