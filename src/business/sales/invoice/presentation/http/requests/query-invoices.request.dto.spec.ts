import { queryInvoicesSchema } from './query-invoices.request.dto';

describe('queryInvoicesSchema', () => {
  it('coerces pagination strings', () => {
    expect(queryInvoicesSchema.parse({ page: '2', pageSize: '20' })).toEqual({
      page: 2,
      pageSize: 20,
    });
  });
});
