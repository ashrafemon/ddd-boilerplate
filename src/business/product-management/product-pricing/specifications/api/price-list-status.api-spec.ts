import { ConflictException } from '@nestjs/common';
import { ActivatePriceListUseCase } from '../../application/use-cases/activate-price-list.usecase';
import { ArchivePriceListUseCase } from '../../application/use-cases/archive-price-list.usecase';
import { DeactivatePriceListUseCase } from '../../application/use-cases/deactivate-price-list.usecase';
import { PriceListController } from '../../presentation/http/price-list.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('PATCH /price-lists/:id/{activate,deactivate,archive}', () => {
  let api: ApiTestApp;
  const activate = { execute: jest.fn() };
  const deactivate = { execute: jest.fn() };
  const archive = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PriceListController,
      providers: [
        { provide: ActivatePriceListUseCase, useValue: activate },
        { provide: DeactivatePriceListUseCase, useValue: deactivate },
        { provide: ArchivePriceListUseCase, useValue: archive },
      ],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('activates a list', async () => {
    activate.execute.mockResolvedValue(undefined);

    const res = await api.http().patch('/price-lists/pl-1/activate').send({}).expect(200);

    expect(activate.execute).toHaveBeenCalledWith({ id: 'pl-1' });
    expect(res.body).toEqual({ id: 'pl-1' });
  });

  it('deactivates a list', async () => {
    deactivate.execute.mockResolvedValue(undefined);

    await api.http().patch('/price-lists/pl-1/deactivate').send({}).expect(200);

    expect(deactivate.execute).toHaveBeenCalledWith({ id: 'pl-1' });
  });

  it('archives a list', async () => {
    archive.execute.mockResolvedValue(undefined);

    await api.http().patch('/price-lists/pl-1/archive').send({}).expect(200);

    expect(archive.execute).toHaveBeenCalledWith({ id: 'pl-1' });
  });

  it('strips an undocumented body field instead of forwarding it', async () => {
    activate.execute.mockResolvedValue(undefined);

    // `ActivatePriceListDto` is `z.object({})`, so `reason` is dropped by the
    // global validation pipe — the use case never sees it.
    await api.http().patch('/price-lists/pl-1/activate').send({ reason: 'go live' }).expect(200);

    expect(activate.execute).toHaveBeenCalledWith({ id: 'pl-1' });
  });

  it('maps an illegal transition to 409', async () => {
    archive.execute.mockRejectedValue(new ConflictException('list is already archived'));

    await api.http().patch('/price-lists/pl-1/archive').send({}).expect(409);
  });
});
