import { ConflictException } from '@nestjs/common';
import { CreatePurchaseOrderUseCase } from '../../application/use-cases/create-purchase-order.usecase';
import { PurchaseOrderController } from '../../presentation/http/purchase-order.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('POST /purchase-orders', () => {
  let api: ApiTestApp;
  const create = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PurchaseOrderController,
      providers: [{ provide: CreatePurchaseOrderUseCase, useValue: create }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('creates a purchase order', async () => {
    create.execute.mockResolvedValue(idOf('po-1'));

    const res = await api
      .http()
      .post('/purchase-orders')
      .send({ vendorId: '11111111-1111-4111-8111-111111111111' })
      .expect(201);

    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Purchase order created' });
  });

  it('defaults the currency to USD', async () => {
    create.execute.mockResolvedValue(idOf('po-1'));

    await api
      .http()
      .post('/purchase-orders')
      .send({ vendorId: '11111111-1111-4111-8111-111111111111' })
      .expect(201);

    expect(create.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorId: '11111111-1111-4111-8111-111111111111',
        currency: 'USD',
      }),
    );
  });

  it('rejects a non-uuid vendorId (400)', async () => {
    await api.http().post('/purchase-orders').send({ vendorId: 'v-1' }).expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('maps an ineligible vendor to 409', async () => {
    create.execute.mockRejectedValue(new ConflictException('vendor is blocked'));

    await api
      .http()
      .post('/purchase-orders')
      .send({ vendorId: '11111111-1111-4111-8111-111111111111' })
      .expect(409);
  });

  it('is marked @Idempotent() so a replayed create is not duplicated', () => {
    const handler = Object.getOwnPropertyDescriptor(PurchaseOrderController.prototype, 'create')
      ?.value as unknown as object;

    expect(Reflect.getMetadata('idempotentScope', handler)).toBe(true);
  });
});
