import { NumberingAdapter } from './numbering.adapter';

describe('PriceList NumberingAdapter', () => {
  it('generates a numeric number with the requested prefix and length', async () => {
    const adapter = new NumberingAdapter();
    const value = await adapter.nextNumber('price-list', { prefix: 'PL-', length: 6 });
    expect(value).toMatch(/^PL-\d{6}$/);
  });

  it('defaults to an eight digit number without a prefix', async () => {
    const adapter = new NumberingAdapter();
    await expect(adapter.nextNumber('price-list')).resolves.toMatch(/^\d{8}$/);
  });
});
