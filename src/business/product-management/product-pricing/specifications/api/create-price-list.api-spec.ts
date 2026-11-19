import { ConflictException } from '@nestjs/common';
import { CreatePriceListUseCase } from '../../application/use-cases/create-price-list.usecase';
import { PriceListController } from '../../presentation/http/price-list.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

const validBody = {
  name: 'Retail',
  code: 'STD',
  currency: 'USD',
  effectiveFrom: '2025-01-01T00:00:00.000Z',
};

describe('POST /price-lists', () => {
  let api: ApiTestApp;
  const create = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PriceListController,
      providers: [{ provide: CreatePriceListUseCase, useValue: create }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('creates a price list', async () => {
    create.execute.mockResolvedValue('pl-1');

    const res = await api.http().post('/price-lists').send(validBody).expect(201);

    expect(res.body).toEqual({ id: 'pl-1' });
  });

  it('rejects a body missing code (400)', async () => {
    await api.http().post('/price-lists').send({ name: 'Retail' }).expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('rejects a non-ISO effectiveFrom (400)', async () => {
    await api
      .http()
      .post('/price-lists')
      .send({ ...validBody, effectiveFrom: 'tomorrow' })
      .expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('maps a duplicate code to 409', async () => {
    create.execute.mockRejectedValue(new ConflictException('duplicate code'));

    await api.http().post('/price-lists').send(validBody).expect(409);
  });
});
