import { ConflictException } from '@nestjs/common';
import { CreateVendorUseCase } from '../../application/use-cases/create-vendor.usecase';
import { VendorController } from '../../presentation/http/vendor.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('POST /vendors', () => {
  let api: ApiTestApp;
  const create = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: VendorController,
      providers: [{ provide: CreateVendorUseCase, useValue: create }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('creates a vendor', async () => {
    create.execute.mockResolvedValue(idOf('v-1'));

    const res = await api.http().post('/vendors').send({ code: 'VEN-1', name: 'Acme' }).expect(201);

    expect(res.body).toEqual({ data: { id: 'v-1' }, message: 'Vendor created' });
  });

  it('rejects a body without the required code (400)', async () => {
    await api.http().post('/vendors').send({ name: 'Acme' }).expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('rejects an invalid email (400)', async () => {
    await api
      .http()
      .post('/vendors')
      .send({ code: 'VEN-2', name: 'Acme', email: 'not-an-email' })
      .expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('maps a duplicate code to 409', async () => {
    create.execute.mockRejectedValue(new ConflictException('duplicate code'));

    await api.http().post('/vendors').send({ code: 'VEN-1', name: 'Acme' }).expect(409);
  });
});
