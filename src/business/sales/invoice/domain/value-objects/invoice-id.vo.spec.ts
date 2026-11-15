import { InvoiceId } from './invoice-id.vo';

describe('InvoiceId', () => {
  it('wraps a string value', () => {
    expect(InvoiceId.fromString('inv-1').value).toBe('inv-1');
  });

  it('generates a UUID', () => {
    expect(InvoiceId.generate().value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('stringifies and compares', () => {
    expect(InvoiceId.fromString('a').toString()).toBe('a');
    expect(InvoiceId.fromString('a').equals(InvoiceId.fromString('a'))).toBe(true);
    expect(InvoiceId.fromString('a').equals(undefined)).toBe(false);
  });
});
