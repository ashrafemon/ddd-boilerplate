import { GrnController } from '../../presentation/http/grn.controller';
import { CreateGrnUseCase } from '../../application/use-cases/create-grn.usecase';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

const validBody = {
  purchaseOrderId: '11111111-1111-4111-8111-111111111111',
  vendorId: '22222222-2222-4222-8222-222222222222',
  lines: [
    {
      productId: '33333333-3333-4333-8333-333333333333',
      orderedQuantity: 5,
      receivedQuantity: 5,
      unitPrice: 10,
    },
  ],
};

describe('POST /grn', () => {
  let api: ApiTestApp;
  const create = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: GrnController,
      providers: [{ provide: CreateGrnUseCase, useValue: create }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('creates a GRN', async () => {
    create.execute.mockResolvedValue(idOf('grn-1'));

    const res = await api.http().post('/grn').send(validBody).expect(201);

    expect(res.body).toEqual({ data: { id: 'grn-1' }, message: 'GRN created' });
  });

  it('rejects a body without lines (400)', async () => {
    await api.http().post('/grn').send({ purchaseOrderId: validBody.purchaseOrderId }).expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid productId (400)', async () => {
    await api
      .http()
      .post('/grn')
      .send({
        ...validBody,
        lines: [{ ...validBody.lines[0], productId: 'p-1' }],
      })
      .expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('accepts an optional idempotencyKey and forwards it', async () => {
    create.execute.mockResolvedValue(idOf('grn-1'));

    await api
      .http()
      .post('/grn')
      .send({ ...validBody, idempotencyKey: 'grn-key-1' })
      .expect(201);

    expect(create.execute).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'grn-key-1' }),
    );
  });

  it('is marked @Idempotent() so a replayed create is not duplicated', () => {
    const handler = Object.getOwnPropertyDescriptor(GrnController.prototype, 'create')
      ?.value as unknown as object;

    expect(Reflect.getMetadata('idempotentScope', handler)).toBe(true);
  });
});
