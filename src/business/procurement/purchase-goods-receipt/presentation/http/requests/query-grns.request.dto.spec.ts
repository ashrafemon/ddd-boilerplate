import { queryGrnsSchema } from './query-grns.request.dto';

describe('queryGrnsSchema', () => {
  it('coerces pagination strings', () => {
    expect(queryGrnsSchema.parse({ page: '1', pageSize: '25' })).toEqual({
      page: 1,
      pageSize: 25,
    });
  });
});
