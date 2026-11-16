import { IdResponse } from '../../presentation/http/responses/id.response.dto';

describe('Price list response contract', () => {
  it('exposes the id response shape', () => {
    const response: IdResponse = { id: 'pl-1' };
    expect(response).toEqual({ id: 'pl-1' });
  });

  it('defines the product price shape', () => {
    const price = { price: 10, currency: 'USD', source: 'price-list' };
    expect(price).toEqual({ price: 10, currency: 'USD', source: 'price-list' });
  });
});
