import { NotFoundException } from '@nestjs/common';
import { UpdateVendorUseCase } from '../../application/use-cases/update-vendor.usecase';
import { VendorController } from '../../presentation/http/vendor.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('PATCH /vendors/:id', () => {
  let api: ApiTestApp;
  const update = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: VendorController,
      providers: [{ provide: UpdateVendorUseCase, useValue: update }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('updates the vendor', async () => {
    update.execute.mockResolvedValue(idOf('v-1'));

    const res = await api.http().patch('/vendors/v-1').send({ name: 'Updated' }).expect(200);

    expect(update.execute).toHaveBeenCalledWith({ id: 'v-1', name: 'Updated' });
    expect(res.body).toEqual({ data: { id: 'v-1' }, message: 'Vendor updated' });
  });

  it('maps an unknown vendor to 404', async () => {
    update.execute.mockRejectedValue(new NotFoundException('Vendor not found'));

    await api.http().patch('/vendors/v-missing').send({ name: 'Updated' }).expect(404);
  });
});
