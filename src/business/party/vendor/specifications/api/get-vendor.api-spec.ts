import { NotFoundException } from '@nestjs/common';
import { GetVendorUseCase } from '../../application/use-cases/get-vendor.usecase';
import { VendorController } from '../../presentation/http/vendor.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /vendors/:id', () => {
  let api: ApiTestApp;
  const get = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: VendorController,
      providers: [{ provide: GetVendorUseCase, useValue: get }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('returns the vendor', async () => {
    get.execute.mockResolvedValue({ id: 'v-1', name: 'Acme' });

    const res = await api.http().get('/vendors/v-1').expect(200);

    expect(res.body).toEqual({
      data: { id: 'v-1', name: 'Acme' },
      message: 'Vendor fetched',
    });
  });

  it('maps a missing vendor to 404', async () => {
    get.execute.mockRejectedValue(new NotFoundException('Vendor not found'));

    await api.http().get('/vendors/v-missing').expect(404);
  });
});
