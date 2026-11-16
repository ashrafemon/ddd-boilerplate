import { IdResponse } from './id.response.dto';

describe('IdResponse', () => {
  it('carries an id', () => {
    const response: IdResponse = { id: 'inv-1' };
    expect(response.id).toBe('inv-1');
  });
});
