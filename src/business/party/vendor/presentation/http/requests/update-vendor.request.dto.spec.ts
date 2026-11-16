import { updateVendorSchema } from './update-vendor.request.dto';

describe('updateVendorSchema', () => {
  it('accepts a name update', () => {
    expect(updateVendorSchema.safeParse({ name: 'Updated' }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(updateVendorSchema.safeParse({ name: '' }).success).toBe(false);
  });
});
