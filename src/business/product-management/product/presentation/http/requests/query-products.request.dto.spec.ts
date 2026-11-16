import { queryProductsSchema } from './query-products.request.dto';

describe('queryProductsSchema', () => {
  it('coerces pagination strings', () => {
    expect(queryProductsSchema.parse({ page: '3' })).toEqual({ page: 3 });
  });
});
