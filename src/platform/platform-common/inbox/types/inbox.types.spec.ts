import { hashInboxPayload } from './inbox.types';

/**
 * Unit — payload hashing rules. The hash guards an identity: the same content
 * must hash identically regardless of key order, and different content must not
 * collide, otherwise the inbox would either double-execute or park good messages.
 */
describe('hashInboxPayload', () => {
  it('is stable for the same payload', () => {
    expect(hashInboxPayload({ grnId: 'grn-1', total: 10 })).toBe(
      hashInboxPayload({ total: 10, grnId: 'grn-1' }),
    );
  });

  it('ignores undefined members but keeps null', () => {
    expect(hashInboxPayload({ a: 1, b: undefined })).toBe(hashInboxPayload({ a: 1 }));
    expect(hashInboxPayload({ a: null })).not.toBe(hashInboxPayload({}));
  });

  it('distinguishes nested content', () => {
    expect(hashInboxPayload({ lines: [{ sku: 'A', qty: 1 }] })).not.toBe(
      hashInboxPayload({ lines: [{ sku: 'A', qty: 2 }] }),
    );
  });

  it('handles scalars, arrays and null', () => {
    expect(hashInboxPayload(null)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashInboxPayload([1, 2])).not.toBe(hashInboxPayload([2, 1]));
    expect(hashInboxPayload('text')).not.toBe(hashInboxPayload(1));
  });
});
