import { updateProductSchema } from './update-product.request.dto';

describe('updateProductSchema', () => {
  it('accepts a name update', () => {
    expect(updateProductSchema.safeParse({ name: 'Keyboard' }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(updateProductSchema.safeParse({ name: '' }).success).toBe(false);
  });
});
