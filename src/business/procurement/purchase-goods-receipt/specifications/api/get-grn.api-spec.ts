import { NotFoundException } from '@nestjs/common';
import { GetGrnUseCase } from '../../application/use-cases/get-grn.usecase';
import { GrnController } from '../../presentation/http/grn.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /grn/:id', () => {
  let api: ApiTestApp;
  const get = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: GrnController,
      providers: [{ provide: GetGrnUseCase, useValue: get }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('returns the GRN', async () => {
    get.execute.mockResolvedValue({ id: 'grn-1', grnNumber: 'GRN-1' });

    const res = await api.http().get('/grn/grn-1').expect(200);

    expect(res.body).toEqual({
      data: { id: 'grn-1', grnNumber: 'GRN-1' },
      message: 'GRN fetched',
    });
  });

  it('maps a missing GRN to 404', async () => {
    get.execute.mockRejectedValue(new NotFoundException('GRN not found'));

    await api.http().get('/grn/grn-missing').expect(404);
  });
});
