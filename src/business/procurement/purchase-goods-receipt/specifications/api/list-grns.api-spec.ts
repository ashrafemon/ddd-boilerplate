import { ListGrnsUseCase } from '../../application/use-cases/list-grns.usecase';
import { GrnController } from '../../presentation/http/grn.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /grn', () => {
  let api: ApiTestApp;
  const list = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: GrnController,
      providers: [{ provide: ListGrnsUseCase, useValue: list }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('lists GRNs', async () => {
    list.execute.mockResolvedValue({ items: [], total: 0 });

    const res = await api.http().get('/grn').expect(200);

    expect(res.body).toEqual({ data: { items: [], total: 0 }, message: 'GRNs fetched' });
  });

  it('passes the paging query through to the use case', async () => {
    list.execute.mockResolvedValue({ items: [], total: 0 });

    await api.http().get('/grn?page=1&pageSize=20').expect(200);

    expect(list.execute).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 20 }));
  });
});
