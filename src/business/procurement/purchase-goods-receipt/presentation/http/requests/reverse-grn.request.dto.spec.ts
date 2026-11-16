import { reverseGrnSchema } from './reverse-grn.request.dto';

describe('reverseGrnSchema', () => {
  it('accepts an empty body', () => {
    expect(reverseGrnSchema.safeParse({}).success).toBe(true);
  });

  it('rejects an over-long idempotency key', () => {
    expect(reverseGrnSchema.safeParse({ idempotencyKey: 'x'.repeat(201) }).success).toBe(false);
  });
});
