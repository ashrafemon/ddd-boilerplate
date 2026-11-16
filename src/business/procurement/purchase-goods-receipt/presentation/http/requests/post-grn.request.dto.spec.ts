import { postGrnSchema } from './post-grn.request.dto';

describe('postGrnSchema', () => {
  it('accepts an empty body', () => {
    expect(postGrnSchema.safeParse({}).success).toBe(true);
  });

  it('retains an idempotency key', () => {
    expect(postGrnSchema.parse({ idempotencyKey: 'key-1' }).idempotencyKey).toBe('key-1');
  });
});
