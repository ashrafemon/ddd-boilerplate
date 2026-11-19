import { ConflictException } from '@nestjs/common';
import { ProductStatusUseCase } from '../../application/use-cases/product-status.usecase';
import { ProductController } from '../../presentation/http/product.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('PATCH /products/:id/{activate,deactivate,discontinue}', () => {
  let api: ApiTestApp;
  const status = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: ProductController,
      providers: [{ provide: ProductStatusUseCase, useValue: status }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['activate', 'Product activated'],
    ['deactivate', 'Product deactivated'],
    ['discontinue', 'Product discontinued'],
  ])('%s sends the action and returns the message', async (action, message) => {
    status.execute.mockResolvedValue(idOf('p-1'));

    const res = await api.http().patch(`/products/p-1/${action}`).expect(200);

    expect(status.execute).toHaveBeenCalledWith({ id: 'p-1', action });
    expect(res.body).toEqual({ data: { id: 'p-1' }, message });
  });

  it('maps an illegal transition to 409', async () => {
    status.execute.mockRejectedValue(new ConflictException('product is discontinued'));

    await api.http().patch('/products/p-1/activate').expect(409);
  });
});
