import { Test, TestingModule } from '@nestjs/testing';
import { VendorController } from './vendor.controller';
import { CreateVendorUseCase } from '../../application/use-cases/create-vendor.usecase';
import { GetVendorUseCase } from '../../application/use-cases/get-vendor.usecase';
import { ListVendorsUseCase } from '../../application/use-cases/list-vendors.usecase';
import { UpdateVendorUseCase } from '../../application/use-cases/update-vendor.usecase';
import { VendorStatusUseCase } from '../../application/use-cases/vendor-status.usecase';

const idOf = (value: string) => ({ toString: () => value });

describe('VendorController (component)', () => {
  let controller: VendorController;
  const mocks = {
    create: { execute: jest.fn() },
    get: { execute: jest.fn() },
    list: { execute: jest.fn() },
    update: { execute: jest.fn() },
    status: { execute: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
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
    controller = module.get(VendorController);
  });

  it('creates a vendor', async () => {
    mocks.create.execute.mockResolvedValue(idOf('v-1'));
    const res = await controller.create({ code: 'V1', name: 'Vendor' });
    expect(mocks.create.execute).toHaveBeenCalled();
    expect(res.data).toEqual({ id: 'v-1' });
  });

  it('lists vendors', async () => {
    mocks.list.execute.mockResolvedValue({ items: [], total: 0 });
    const res = await controller.list({});
    expect(res.data).toEqual({ items: [], total: 0 });
  });

  it('gets a vendor by id', async () => {
    mocks.get.execute.mockResolvedValue({ id: 'v-1' });
    const res = await controller.get('v-1');
    expect(mocks.get.execute).toHaveBeenCalledWith('v-1');
    expect(res.data).toEqual({ id: 'v-1' });
  });

  it('updates a vendor', async () => {
    mocks.update.execute.mockResolvedValue(idOf('v-1'));
    const res = await controller.update('v-1', { name: 'Updated' });
    expect(mocks.update.execute).toHaveBeenCalledWith({ id: 'v-1', name: 'Updated' });
    expect(res.data).toEqual({ id: 'v-1' });
  });

  it('transitions vendor status', async () => {
    mocks.status.execute.mockResolvedValue(idOf('v-1'));
    expect((await controller.activate('v-1')).data).toEqual({ id: 'v-1' });
    expect((await controller.deactivate('v-1')).data).toEqual({ id: 'v-1' });
    expect((await controller.block('v-1')).data).toEqual({ id: 'v-1' });
    expect(mocks.status.execute).toHaveBeenCalledWith({ id: 'v-1', action: 'activate' });
    expect(mocks.status.execute).toHaveBeenCalledWith({ id: 'v-1', action: 'deactivate' });
    expect(mocks.status.execute).toHaveBeenCalledWith({ id: 'v-1', action: 'block' });
  });
});
