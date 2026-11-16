import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { VendorController } from '../../presentation/http/vendor.controller';
import { CreateVendorUseCase } from '../../application/use-cases/create-vendor.usecase';
import { GetVendorUseCase } from '../../application/use-cases/get-vendor.usecase';
import { ListVendorsUseCase } from '../../application/use-cases/list-vendors.usecase';
import { UpdateVendorUseCase } from '../../application/use-cases/update-vendor.usecase';
import { VendorStatusUseCase } from '../../application/use-cases/vendor-status.usecase';

const idOf = (value: string) => ({ toString: () => value });

describe('Vendor API', () => {
  let app: NestFastifyApplication;
  const mocks = {
    create: { execute: jest.fn() },
    get: { execute: jest.fn() },
    list: { execute: jest.fn() },
    update: { execute: jest.fn() },
    status: { execute: jest.fn() },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorController],
      providers: [
        { provide: CreateVendorUseCase, useValue: mocks.create },
        { provide: GetVendorUseCase, useValue: mocks.get },
        { provide: ListVendorsUseCase, useValue: mocks.list },
        { provide: UpdateVendorUseCase, useValue: mocks.update },
        { provide: VendorStatusUseCase, useValue: mocks.status },
      ],
    }).compile();
    app = module.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('POST /vendors creates a vendor', async () => {
    mocks.create.execute.mockResolvedValue(idOf('v-1'));
    const res = await request(app.getHttpServer())
      .post('/vendors')
      .send({ code: 'VEN-1', name: 'Acme' })
      .expect(201);
    expect(res.body).toEqual({ data: { id: 'v-1' }, message: 'Vendor created' });
  });

  it('GET /vendors lists vendors', async () => {
    mocks.list.execute.mockResolvedValue({ items: [], total: 0 });
    const res = await request(app.getHttpServer()).get('/vendors').expect(200);
    expect(res.body).toEqual({ data: { items: [], total: 0 }, message: 'Vendors fetched' });
  });

  it('GET /vendors/:id returns a vendor', async () => {
    mocks.get.execute.mockResolvedValue({ id: 'v-1', name: 'Acme' });
    const res = await request(app.getHttpServer()).get('/vendors/v-1').expect(200);
    expect(res.body).toEqual({ data: { id: 'v-1', name: 'Acme' }, message: 'Vendor fetched' });
  });

  it('PATCH /vendors/:id/block blocks a vendor', async () => {
    mocks.status.execute.mockResolvedValue(idOf('v-1'));
    const res = await request(app.getHttpServer()).patch('/vendors/v-1/block').expect(200);
    expect(mocks.status.execute).toHaveBeenCalledWith({ id: 'v-1', action: 'block' });
    expect(res.body).toEqual({ data: { id: 'v-1' }, message: 'Vendor blocked' });
  });

  it('PATCH /vendors/:id updates a vendor', async () => {
    mocks.update.execute.mockResolvedValue(idOf('v-1'));
    const res = await request(app.getHttpServer())
      .patch('/vendors/v-1')
      .send({ name: 'Updated' })
      .expect(200);
    expect(mocks.update.execute).toHaveBeenCalledWith({ id: 'v-1', name: 'Updated' });
    expect(res.body).toEqual({ data: { id: 'v-1' }, message: 'Vendor updated' });
  });

  it('PATCH /vendors/:id/activate and /deactivate transition status', async () => {
    mocks.status.execute.mockResolvedValue(idOf('v-1'));
    const activated = await request(app.getHttpServer()).patch('/vendors/v-1/activate').expect(200);
    const deactivated = await request(app.getHttpServer())
      .patch('/vendors/v-1/deactivate')
      .expect(200);
    expect(mocks.status.execute).toHaveBeenCalledWith({ id: 'v-1', action: 'activate' });
    expect(mocks.status.execute).toHaveBeenCalledWith({ id: 'v-1', action: 'deactivate' });
    expect(activated.body).toEqual({ data: { id: 'v-1' }, message: 'Vendor activated' });
    expect(deactivated.body).toEqual({ data: { id: 'v-1' }, message: 'Vendor deactivated' });
  });
});
