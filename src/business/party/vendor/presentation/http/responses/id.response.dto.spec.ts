import { IdResponse } from './id.response.dto';

describe('IdResponse', () => {
  it('carries an id', () => {
    const response: IdResponse = { id: 'v-1' };
    expect(response.id).toBe('v-1');
  });
});
