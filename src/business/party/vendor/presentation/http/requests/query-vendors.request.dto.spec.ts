import { queryVendorsSchema } from './query-vendors.request.dto';

describe('queryVendorsSchema', () => {
  it('accepts and coerces pagination strings', () => {
    expect(queryVendorsSchema.parse({ page: '2', pageSize: '10' })).toEqual({
      page: 2,
      pageSize: 10,
    });
  });

  it('accepts an empty query', () => {
    expect(queryVendorsSchema.safeParse({}).success).toBe(true);
  });
});
