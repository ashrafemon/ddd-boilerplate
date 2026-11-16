import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceController } from './invoice.controller';
import { CreateInvoiceUseCase } from '../../application/use-cases/create-invoice.usecase';
import { GetInvoiceUseCase } from '../../application/use-cases/get-invoice.usecase';
import { ListInvoicesUseCase } from '../../application/use-cases/list-invoices.usecase';
import { PostInvoiceUseCase } from '../../application/use-cases/post-invoice.usecase';

const idOf = (value: string) => ({ toString: () => value });

describe('InvoiceController (component)', () => {
  let controller: InvoiceController;
  const mocks = {
    create: { execute: jest.fn() },
    post: { execute: jest.fn() },
    get: { execute: jest.fn() },
    list: { execute: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [
        { provide: CreateInvoiceUseCase, useValue: mocks.create },
        { provide: PostInvoiceUseCase, useValue: mocks.post },
        { provide: GetInvoiceUseCase, useValue: mocks.get },
        { provide: ListInvoicesUseCase, useValue: mocks.list },
      ],
    }).compile();
    controller = module.get(InvoiceController);
  });

  it('creates a draft invoice', async () => {
    mocks.create.execute.mockResolvedValue(idOf('inv-1'));
    expect((await controller.create({ customerName: 'Acme' } as any)).data).toEqual({
      id: 'inv-1',
    });
  });

  it('posts an invoice', async () => {
    mocks.post.execute.mockResolvedValue(idOf('inv-1'));
    expect((await controller.post('inv-1')).data).toEqual({ id: 'inv-1' });
    expect(mocks.post.execute).toHaveBeenCalledWith('inv-1');
  });

  it('gets and lists invoices', async () => {
    mocks.get.execute.mockResolvedValue({ id: 'inv-1' });
    mocks.list.execute.mockResolvedValue({ items: [], total: 0 });
    expect((await controller.get('inv-1')).data).toEqual({ id: 'inv-1' });
    expect((await controller.list({} as any)).data).toEqual({ items: [], total: 0 });
  });
});
