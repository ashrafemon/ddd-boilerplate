import { IdResponse } from './id.response.dto';

describe('IdResponse', () => {
  it('carries an id', () => {
    const response: IdResponse = { id: 'grn-1' };
    expect(response.id).toBe('grn-1');
  });
});
