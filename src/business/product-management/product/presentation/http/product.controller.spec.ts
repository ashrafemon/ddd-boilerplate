import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ChangePriceUseCase } from '../../application/use-cases/change-price.usecase';
import { CreateProductUseCase } from '../../application/use-cases/create-product.usecase';
import { GetProductUseCase } from '../../application/use-cases/get-product.usecase';
import { ListProductsUseCase } from '../../application/use-cases/list-products.usecase';
import { ProductStatusUseCase } from '../../application/use-cases/product-status.usecase';
import { UpdateProductUseCase } from '../../application/use-cases/update-product.usecase';

const idOf = (value: string) => ({ toString: () => value });

describe('ProductController (component)', () => {
  let controller: ProductController;
  const mocks = {
    create: { execute: jest.fn() },
    update: { execute: jest.fn() },
    changePrice: { execute: jest.fn() },
    status: { execute: jest.fn() },
    get: { execute: jest.fn() },
    list: { execute: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: CreateProductUseCase, useValue: mocks.create },
        { provide: UpdateProductUseCase, useValue: mocks.update },
        { provide: ChangePriceUseCase, useValue: mocks.changePrice },
        { provide: ProductStatusUseCase, useValue: mocks.status },
        { provide: GetProductUseCase, useValue: mocks.get },
        { provide: ListProductsUseCase, useValue: mocks.list },
      ],
    }).compile();
    controller = module.get(ProductController);
  });

  it('creates a product', async () => {
    mocks.create.execute.mockResolvedValue(idOf('p-1'));
    const res = await controller.create({ sku: 'SKU-1', name: 'Mouse' } as any);
    expect(res.data).toEqual({ id: 'p-1' });
  });

  it('updates a product', async () => {
    mocks.update.execute.mockResolvedValue(idOf('p-1'));
    const res = await controller.update('p-1', { name: 'Keyboard' });
    expect(mocks.update.execute).toHaveBeenCalledWith({ id: 'p-1', name: 'Keyboard' });
    expect(res.data).toEqual({ id: 'p-1' });
  });

  it('changes product price', async () => {
    mocks.changePrice.execute.mockResolvedValue(idOf('p-1'));
    await controller.changePrice('p-1', { unitPrice: 12.5 } as any);
    expect(mocks.changePrice.execute).toHaveBeenCalledWith({ id: 'p-1', unitPrice: 12.5 });
  });

  it('transitions status', async () => {
    mocks.status.execute.mockResolvedValue(idOf('p-1'));
    expect((await controller.activate('p-1')).data).toEqual({ id: 'p-1' });
    expect((await controller.deactivate('p-1')).data).toEqual({ id: 'p-1' });
    expect((await controller.discontinue('p-1')).data).toEqual({ id: 'p-1' });
    expect(mocks.status.execute).toHaveBeenCalledWith({ id: 'p-1', action: 'activate' });
    expect(mocks.status.execute).toHaveBeenCalledWith({ id: 'p-1', action: 'deactivate' });
    expect(mocks.status.execute).toHaveBeenCalledWith({ id: 'p-1', action: 'discontinue' });
  });

  it('gets and lists products', async () => {
    mocks.get.execute.mockResolvedValue({ id: 'p-1' });
    mocks.list.execute.mockResolvedValue({ items: [], total: 0 });
    expect((await controller.get('p-1')).data).toEqual({ id: 'p-1' });
    expect((await controller.list({} as any)).data).toEqual({ items: [], total: 0 });
  });
});
