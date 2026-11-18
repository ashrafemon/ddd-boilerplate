import { Test, TestingModule } from '@nestjs/testing';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { PurchaseOrderController } from './purchase-order.controller';
import { CreatePurchaseOrderUseCase } from '../../application/use-cases/create-purchase-order.usecase';
import { AddPurchaseOrderLineUseCase } from '../../application/use-cases/add-purchase-order-line.usecase';
import { UpdatePurchaseOrderUseCase } from '../../application/use-cases/update-purchase-order.usecase';
import { UpdatePurchaseOrderLineUseCase } from '../../application/use-cases/update-purchase-order-line.usecase';
import { RemovePurchaseOrderLineUseCase } from '../../application/use-cases/remove-purchase-order-line.usecase';
import { GetPurchaseOrderReceiptsUseCase } from '../../application/use-cases/get-purchase-order-receipts.usecase';
import { GetPurchaseOrderRemainingQuantitiesUseCase } from '../../application/use-cases/get-purchase-order-remaining-quantities.usecase';
import { SubmitPurchaseOrderUseCase } from '../../application/use-cases/submit-purchase-order.usecase';
import { ApprovePurchaseOrderUseCase } from '../../application/use-cases/approve-purchase-order.usecase';
import { RejectPurchaseOrderUseCase } from '../../application/use-cases/reject-purchase-order.usecase';
import { CancelPurchaseOrderUseCase } from '../../application/use-cases/cancel-purchase-order.usecase';
import { CompletePurchaseOrderUseCase } from '../../application/use-cases/complete-purchase-order.usecase';
import { AmendPurchaseOrderUseCase } from '../../application/use-cases/amend-purchase-order.usecase';
import { IssuePurchaseOrderUseCase } from '../../application/use-cases/issue-purchase-order.usecase';
import { ClosePurchaseOrderUseCase } from '../../application/use-cases/close-purchase-order.usecase';
import { GetPurchaseOrderUseCase } from '../../application/use-cases/get-purchase-order.usecase';
import { ListPurchaseOrdersUseCase } from '../../application/use-cases/list-purchase-orders.usecase';
import { CreateRecurringPurchaseOrderUseCase } from '../../application/use-cases/create-recurring-purchase-order.usecase';
import { CreateRecurringFromPurchaseOrderUseCase } from '../../application/use-cases/create-recurring-from-purchase-order.usecase';

const idOf = (value: string) => ({ toString: () => value });

describe('PurchaseOrderController (component)', () => {
  let controller: PurchaseOrderController;
  const mocks = {
    create: { execute: jest.fn() },
    addLine: { execute: jest.fn() },
    update: { execute: jest.fn() },
    updateLine: { execute: jest.fn() },
    removeLine: { execute: jest.fn() },
    receipts: { execute: jest.fn() },
    remaining: { execute: jest.fn() },
    submit: { execute: jest.fn() },
    approve: { execute: jest.fn() },
    reject: { execute: jest.fn() },
    cancel: { execute: jest.fn() },
    complete: { execute: jest.fn() },
    amend: { execute: jest.fn() },
    issue: { execute: jest.fn() },
    close: { execute: jest.fn() },
    get: { execute: jest.fn() },
    list: { execute: jest.fn() },
    createRecurring: { execute: jest.fn() },
    createRecurringFrom: { execute: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [
        { provide: CreatePurchaseOrderUseCase, useValue: mocks.create },
        { provide: AddPurchaseOrderLineUseCase, useValue: mocks.addLine },
        { provide: UpdatePurchaseOrderUseCase, useValue: mocks.update },
        { provide: UpdatePurchaseOrderLineUseCase, useValue: mocks.updateLine },
        { provide: RemovePurchaseOrderLineUseCase, useValue: mocks.removeLine },
        { provide: GetPurchaseOrderReceiptsUseCase, useValue: mocks.receipts },
        { provide: GetPurchaseOrderRemainingQuantitiesUseCase, useValue: mocks.remaining },
        { provide: SubmitPurchaseOrderUseCase, useValue: mocks.submit },
        { provide: ApprovePurchaseOrderUseCase, useValue: mocks.approve },
        { provide: RejectPurchaseOrderUseCase, useValue: mocks.reject },
        { provide: CancelPurchaseOrderUseCase, useValue: mocks.cancel },
        { provide: CompletePurchaseOrderUseCase, useValue: mocks.complete },
        { provide: AmendPurchaseOrderUseCase, useValue: mocks.amend },
        { provide: IssuePurchaseOrderUseCase, useValue: mocks.issue },
        { provide: ClosePurchaseOrderUseCase, useValue: mocks.close },
        { provide: GetPurchaseOrderUseCase, useValue: mocks.get },
        { provide: ListPurchaseOrdersUseCase, useValue: mocks.list },
        { provide: CreateRecurringPurchaseOrderUseCase, useValue: mocks.createRecurring },
        { provide: CreateRecurringFromPurchaseOrderUseCase, useValue: mocks.createRecurringFrom },
        { provide: RequestContextPort, useValue: { require: jest.fn(), get: jest.fn() } },
      ],
    }).compile();
    controller = module.get(PurchaseOrderController);
  });

  it('creates a purchase order', async () => {
    mocks.create.execute.mockResolvedValue(idOf('po-1'));
    const res = await controller.create({ vendorId: 'v-1' } as any);
    expect(res.data).toEqual({ id: 'po-1' });
  });

  it('adds a line', async () => {
    mocks.addLine.execute.mockResolvedValue(idOf('po-1'));
    const res = await controller.addLine('po-1', { productId: 'p-1', quantity: 2 } as any);
    expect(mocks.addLine.execute).toHaveBeenCalledWith({
      id: 'po-1',
      productId: 'p-1',
      quantity: 2,
    });
    expect(res.data).toEqual({ id: 'po-1' });
  });

  it('removes a line', async () => {
    mocks.removeLine.execute.mockResolvedValue(idOf('po-1'));
    const res = await controller.removeLine('po-1', 'p-1');
    expect(mocks.removeLine.execute).toHaveBeenCalledWith({ id: 'po-1', productId: 'p-1' });
    expect(res.data).toEqual({ id: 'po-1' });
  });

  it('submits, approves, cancels and completes', async () => {
    mocks.submit.execute.mockResolvedValue(idOf('po-1'));
    mocks.approve.execute.mockResolvedValue(idOf('po-1'));
    mocks.cancel.execute.mockResolvedValue(idOf('po-1'));
    mocks.complete.execute.mockResolvedValue(idOf('po-1'));
    expect((await controller.submit('po-1')).data).toEqual({ id: 'po-1' });
    expect((await controller.approve('po-1')).data).toEqual({ id: 'po-1' });
    expect((await controller.cancel('po-1')).data).toEqual({ id: 'po-1' });
    expect((await controller.complete('po-1')).data).toEqual({ id: 'po-1' });
  });

  it('rejects with a reason', async () => {
    mocks.reject.execute.mockResolvedValue(idOf('po-1'));
    await controller.reject('po-1', { reason: 'bad' });
    expect(mocks.reject.execute).toHaveBeenCalledWith('po-1', 'bad');
  });

  it('gets a purchase order and lists', async () => {
    mocks.get.execute.mockResolvedValue({ id: 'po-1' });
    mocks.list.execute.mockResolvedValue({ items: [], total: 0 });
    expect((await controller.get('po-1')).data).toEqual({ id: 'po-1' });
    expect((await controller.list({} as any)).data).toEqual({ items: [], total: 0 });
  });

  it('updates a draft header', async () => {
    const expectedDeliveryDate = new Date('2027-01-01T00:00:00Z');
    mocks.update.execute.mockResolvedValue(idOf('po-1'));
    await controller.update('po-1', { expectedDeliveryDate });
    expect(mocks.update.execute).toHaveBeenCalledWith({ id: 'po-1', expectedDeliveryDate });
  });

  it('returns receipts and remaining quantities', async () => {
    const receipts = { purchaseOrderId: 'po-1', receiptStatus: 'NOT_RECEIVED', lines: [] };
    const remaining = { purchaseOrderId: 'po-1', lines: [] };
    mocks.receipts.execute.mockResolvedValue(receipts);
    mocks.remaining.execute.mockResolvedValue(remaining);
    expect((await controller.receipts('po-1')).data).toEqual(receipts);
    expect((await controller.remainingQuantities('po-1')).data).toEqual(remaining);
    expect(mocks.receipts.execute).toHaveBeenCalledWith('po-1');
    expect(mocks.remaining.execute).toHaveBeenCalledWith('po-1');
  });

  it('creates recurring templates', async () => {
    const template = { id: 'rt-1' };
    mocks.createRecurring.execute.mockResolvedValue(template);
    mocks.createRecurringFrom.execute.mockResolvedValue(template);
    expect((await controller.createRecurring({ cadence: 'MONTHLY' } as any)).data).toEqual(
      template,
    );
    expect(
      (await controller.createRecurringFromExisting('po-1', { cadence: 'MONTHLY' } as any)).data,
    ).toEqual(template);
    expect(mocks.createRecurringFrom.execute).toHaveBeenCalledWith({
      cadence: 'MONTHLY',
      purchaseOrderId: 'po-1',
    });
  });

  it('updates a line', async () => {
    mocks.updateLine.execute.mockResolvedValue(idOf('po-1'));
    await controller.updateLine('po-1', 'p-1', { quantity: 3 } as any);
    expect(mocks.updateLine.execute).toHaveBeenCalledWith({
      id: 'po-1',
      productId: 'p-1',
      quantity: 3,
    });
  });

  it('amends, issues and closes', async () => {
    mocks.amend.execute.mockResolvedValue(idOf('po-1'));
    mocks.issue.execute.mockResolvedValue(idOf('po-1'));
    mocks.close.execute.mockResolvedValue(idOf('po-1'));
    await controller.amend('po-1', { reason: 'price change', lineUnitPrices: [] } as any);
    expect(mocks.amend.execute).toHaveBeenCalledWith({
      id: 'po-1',
      expectedDeliveryDate: undefined,
      lineUnitPrices: [],
      reason: 'price change',
    });
    expect((await controller.issue('po-1')).data).toEqual({ id: 'po-1' });
    expect((await controller.close('po-1')).data).toEqual({ id: 'po-1' });
  });
});
