import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateRecurringFromPurchaseOrderUseCase } from './create-recurring-from-purchase-order.usecase';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';

describe('CreateRecurringFromPurchaseOrderUseCase', () => {
  const query = { findById: jest.fn() };
  const numbering = { nextNumber: jest.fn() };
  const templates = { create: jest.fn() };
  const requestContext = { getTenantId: jest.fn(), getUserId: jest.fn() };
  let usecase: CreateRecurringFromPurchaseOrderUseCase;

  const order = {
    id: 'po-1',
    orderNumber: 'PO-100',
    vendorId: 'v-1',
    currency: 'USD',
    lines: [{ productId: 'p-1', quantity: 2, unitPrice: 5 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    query.findById.mockResolvedValue(order);
    numbering.nextNumber.mockResolvedValue('REC-PO-1');
    requestContext.getTenantId.mockReturnValue('tenant-1');
    requestContext.getUserId.mockReturnValue('user-1');
    templates.create.mockResolvedValue({ id: 'rt-1' });
    usecase = new CreateRecurringFromPurchaseOrderUseCase(
      query as unknown as PurchaseOrderQuery,
      numbering,
      templates,
      requestContext as unknown as RequestContextPort,
    );
  });

  it('snapshots the purchase order into a recurring template', async () => {
    await expect(
      usecase.execute({ purchaseOrderId: 'po-1', triggerType: 'TIME' }),
    ).resolves.toEqual({ id: 'rt-1' });
    expect(templates.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Recurring PO-100',
        originDocumentType: 'PurchaseOrder',
        originDocumentId: 'po-1',
        partyId: 'v-1',
        lines: [{ productId: 'p-1', quantity: 2, unitPrice: 5 }],
      }),
    );
  });

  it('throws NotFound when the purchase order is missing', async () => {
    query.findById.mockResolvedValue(null);
    await expect(
      usecase.execute({ purchaseOrderId: 'missing', triggerType: 'TIME' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an order without lines', async () => {
    query.findById.mockResolvedValue({ ...order, lines: [] });
    await expect(
      usecase.execute({ purchaseOrderId: 'po-1', triggerType: 'TIME' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
