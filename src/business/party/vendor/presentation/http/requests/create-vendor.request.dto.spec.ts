import { createVendorSchema } from './create-vendor.request.dto';

describe('createVendorSchema', () => {
  it('accepts a minimal vendor', () => {
    expect(createVendorSchema.safeParse({ code: 'V1', name: 'Acme' }).success).toBe(true);
  });

  it('rejects a missing code', () => {
    expect(createVendorSchema.safeParse({ name: 'Acme' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(createVendorSchema.safeParse({ code: 'V1', name: 'Acme', email: 'nope' }).success).toBe(
      false,
    );
  });
});
