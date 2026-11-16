import { Test, TestingModule } from '@nestjs/testing';
import { PriceListController } from './price-list.controller';
import { CreatePriceListUseCase } from '../../application/use-cases/create-price-list.usecase';
import { UpdatePriceListUseCase } from '../../application/use-cases/update-price-list.usecase';
import { AddPriceListLineUseCase } from '../../application/use-cases/add-price-list-line.usecase';
import { RemovePriceListLineUseCase } from '../../application/use-cases/remove-price-list-line.usecase';
import { ActivatePriceListUseCase } from '../../application/use-cases/activate-price-list.usecase';
import { DeactivatePriceListUseCase } from '../../application/use-cases/deactivate-price-list.usecase';
import { ArchivePriceListUseCase } from '../../application/use-cases/archive-price-list.usecase';
import { GetProductPriceUseCase } from '../../application/use-cases/get-product-price.usecase';

describe('PriceListController (component)', () => {
  let controller: PriceListController;
  const mocks = {
    create: { execute: jest.fn() },
    update: { execute: jest.fn() },
    addLine: { execute: jest.fn() },
    removeLine: { execute: jest.fn() },
    activate: { execute: jest.fn() },
    deactivate: { execute: jest.fn() },
    archive: { execute: jest.fn() },
    price: { execute: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PriceListController],
      providers: [
        { provide: CreatePriceListUseCase, useValue: mocks.create },
        { provide: UpdatePriceListUseCase, useValue: mocks.update },
        { provide: AddPriceListLineUseCase, useValue: mocks.addLine },
        { provide: RemovePriceListLineUseCase, useValue: mocks.removeLine },
        { provide: ActivatePriceListUseCase, useValue: mocks.activate },
        { provide: DeactivatePriceListUseCase, useValue: mocks.deactivate },
        { provide: ArchivePriceListUseCase, useValue: mocks.archive },
        { provide: GetProductPriceUseCase, useValue: mocks.price },
      ],
    }).compile();
    controller = module.get(PriceListController);
  });

  it('creates and updates a price list', async () => {
    mocks.create.execute.mockResolvedValue('pl-1');
    mocks.update.execute.mockResolvedValue(undefined);
    expect(await controller.create({ name: 'List' } as any)).toEqual({ id: 'pl-1' });
    expect(await controller.update('pl-1', { name: 'List 2' } as any)).toEqual({ id: 'pl-1' });
    expect(mocks.update.execute).toHaveBeenCalledWith({ id: 'pl-1', name: 'List 2' });
  });

  it('adds and removes lines', async () => {
    mocks.addLine.execute.mockResolvedValue(undefined);
    mocks.removeLine.execute.mockResolvedValue(undefined);
    expect(await controller.addLine('pl-1', { productId: 'p-1' } as any)).toEqual({ id: 'pl-1' });
    expect(await controller.removeLine('pl-1', 'p-1')).toEqual({ id: 'pl-1' });
    expect(mocks.addLine.execute).toHaveBeenCalledWith({ priceListId: 'pl-1', productId: 'p-1' });
    expect(mocks.removeLine.execute).toHaveBeenCalledWith({
      priceListId: 'pl-1',
      productId: 'p-1',
    });
  });

  it('transitions price list status', async () => {
    expect(await controller.activate('pl-1', { reason: 'x' } as any)).toEqual({ id: 'pl-1' });
    expect(await controller.deactivate('pl-1', { reason: 'x' } as any)).toEqual({ id: 'pl-1' });
    expect(await controller.archive('pl-1', { reason: 'x' } as any)).toEqual({ id: 'pl-1' });
    expect(mocks.activate.execute).toHaveBeenCalledWith({ id: 'pl-1', reason: 'x' });
    expect(mocks.deactivate.execute).toHaveBeenCalledWith({ id: 'pl-1', reason: 'x' });
    expect(mocks.archive.execute).toHaveBeenCalledWith({ id: 'pl-1', reason: 'x' });
  });

  it('resolves a product price', async () => {
    const price = { price: 10, currency: 'USD', source: 'price-list' };
    mocks.price.execute.mockResolvedValue(price);
    expect(await controller.getProductPrice('p-1')).toEqual(price);
    expect(mocks.price.execute).toHaveBeenCalledWith({ productId: 'p-1' });
  });
});
