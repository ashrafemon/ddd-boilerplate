import { queryPurchaseOrdersSchema } from './query-purchase-orders.request.dto';

describe('queryPurchaseOrdersSchema', () => {
  it('coerces pagination strings', () => {
    expect(queryPurchaseOrdersSchema.parse({ page: '2', pageSize: '50' })).toEqual({
      page: 2,
      pageSize: 50,
    });
  });
});
