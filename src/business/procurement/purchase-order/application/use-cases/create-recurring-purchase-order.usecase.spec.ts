import { ConflictException } from '@nestjs/common';
import { CreateRecurringPurchaseOrderUseCase } from './create-recurring-purchase-order.usecase';
import { OrderableVendorPort } from '../outbound-ports/vendor-query.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';

describe('CreateRecurringPurchaseOrderUseCase', () => {
  const vendorPort = { getOrderableVendor: jest.fn() };
  const numbering = { nextNumber: jest.fn() };
  const templates = { create: jest.fn() };
  const requestContext = { getTenantId: jest.fn(), getUserId: jest.fn() };
  let usecase: CreateRecurringPurchaseOrderUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    vendorPort.getOrderableVendor.mockResolvedValue({ id: 'v-1' });
    numbering.nextNumber.mockResolvedValue('REC-PO-1');
    requestContext.getTenantId.mockReturnValue('tenant-1');
    requestContext.getUserId.mockReturnValue('user-1');
    templates.create.mockResolvedValue({ id: 'rt-1' });
    usecase = new CreateRecurringPurchaseOrderUseCase(
      vendorPort as unknown as OrderableVendorPort,
      numbering,
      templates,
      requestContext as unknown as RequestContextPort,
    );
  });

  const input = {
    name: 'Monthly PO',
    vendorId: 'v-1',
    lines: [{ productId: 'p-1', quantity: 2, unitPrice: 5 }],
    triggerType: 'TIME' as const,
  };

  it('creates a recurring template for an orderable vendor', async () => {
    await expect(usecase.execute(input)).resolves.toEqual({ id: 'rt-1' });
    expect(templates.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        templateNo: 'REC-PO-1',
        targetEntityType: 'PurchaseOrder',
        partyId: 'v-1',
        currency: 'USD',
        lines: input.lines,
        createdBy: 'user-1',
      }),
    );
  });

  it('rejects an empty line set', async () => {
    await expect(usecase.execute({ ...input, lines: [] })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(vendorPort.getOrderableVendor).not.toHaveBeenCalled();
  });

  it('rejects a vendor that is not orderable', async () => {
    vendorPort.getOrderableVendor.mockResolvedValue(null);
    await expect(usecase.execute(input)).rejects.toBeInstanceOf(ConflictException);
  });
});
