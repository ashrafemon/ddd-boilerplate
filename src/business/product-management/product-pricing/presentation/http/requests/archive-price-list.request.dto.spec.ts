import { ArchivePriceListSchema } from './archive-price-list.request.dto';

describe('ArchivePriceListSchema', () => {
  it('accepts an empty payload', () => {
    expect(ArchivePriceListSchema.safeParse({}).success).toBe(true);
  });
});
