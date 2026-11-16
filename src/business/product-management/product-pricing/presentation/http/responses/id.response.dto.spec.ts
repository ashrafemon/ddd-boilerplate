import { IdResponse } from './id.response.dto';

describe('IdResponse', () => {
  it('accepts a valid payload', () => {
    expect(() => IdResponse.schema.parse({ id: 'pl-1' })).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => IdResponse.schema.parse({ id: '' })).toThrow();
  });
});
