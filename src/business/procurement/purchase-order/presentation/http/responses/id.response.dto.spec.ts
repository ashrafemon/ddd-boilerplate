import { IdResponse } from './id.response.dto';

describe('IdResponse', () => {
  it('carries an id', () => {
    const response: IdResponse = { id: 'po-1' };
    expect(response.id).toBe('po-1');
  });
});
