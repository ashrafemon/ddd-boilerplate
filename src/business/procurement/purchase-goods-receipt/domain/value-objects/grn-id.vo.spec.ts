import { GrnId } from './grn-id.vo';

describe('GrnId', () => {
  it('wraps a string value', () => {
    expect(GrnId.fromString('grn-1').value).toBe('grn-1');
  });

  it('generates a UUID (db.Uuid column)', () => {
    expect(GrnId.generate().value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('generates unique ids', () => {
    expect(GrnId.generate().value).not.toBe(GrnId.generate().value);
  });

  it('stringifies and compares', () => {
    expect(GrnId.fromString('a').toString()).toBe('a');
    expect(GrnId.fromString('a').equals(GrnId.fromString('a'))).toBe(true);
    expect(GrnId.fromString('a').equals(undefined)).toBe(false);
  });
});
