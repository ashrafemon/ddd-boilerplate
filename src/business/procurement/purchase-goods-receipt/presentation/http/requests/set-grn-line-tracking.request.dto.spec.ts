import { SetGrnLineTrackingSchema } from './set-grn-line-tracking.request.dto';

describe('SetGrnLineTrackingSchema', () => {
  it('accepts tracking entries', () => {
    expect(
      SetGrnLineTrackingSchema.safeParse({
        productId: 'p-1',
        entries: [{ lotNo: 'L1', quantity: 2 }],
      }).success,
    ).toBe(true);
  });

  it('rejects a non-positive quantity', () => {
    expect(
      SetGrnLineTrackingSchema.safeParse({ productId: 'p-1', entries: [{ quantity: 0 }] }).success,
    ).toBe(false);
  });
});
