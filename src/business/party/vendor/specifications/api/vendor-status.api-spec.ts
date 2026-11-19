import { ConflictException } from '@nestjs/common';
import { VendorStatusUseCase } from '../../application/use-cases/vendor-status.usecase';
import { VendorController } from '../../presentation/http/vendor.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('PATCH /vendors/:id/{activate,deactivate,block}', () => {
  let api: ApiTestApp;
  const status = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: VendorController,
      providers: [{ provide: VendorStatusUseCase, useValue: status }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['activate', 'Vendor activated'],
    ['deactivate', 'Vendor deactivated'],
    ['block', 'Vendor blocked'],
  ])('%s sends the action and returns the message', async (action, message) => {
    status.execute.mockResolvedValue(idOf('v-1'));

    const res = await api.http().patch(`/vendors/v-1/${action}`).expect(200);

    expect(status.execute).toHaveBeenCalledWith({ id: 'v-1', action });
    expect(res.body).toEqual({ data: { id: 'v-1' }, message });
  });

  it('maps an illegal transition to 409', async () => {
    status.execute.mockRejectedValue(new ConflictException('vendor is already blocked'));

    await api.http().patch('/vendors/v-1/block').expect(409);
  });
});
