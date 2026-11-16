import { GrnNotificationAdapter } from './grn-notification.adapter';
import { GetGrnUseCase } from '../../../application/use-cases/get-grn.usecase';
import { PurchaseOrderPort } from '../../../application/outbound-ports/purchase-order-query.port';

describe('GrnNotificationAdapter', () => {
  const getGrn = { execute: jest.fn() };
  const purchaseOrderPort = { getPurchaseOrder: jest.fn() };
  let adapter: GrnNotificationAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new GrnNotificationAdapter(
      getGrn as unknown as GetGrnUseCase,
      purchaseOrderPort as unknown as PurchaseOrderPort,
    );
  });

  it('builds the template model from the GRN and purchase order', async () => {
    getGrn.execute.mockResolvedValue({
      grnNumber: 'GRN-1',
      purchaseOrderId: 'po-1',
      vendorId: 'v-1',
      status: 'RECEIVED',
      currency: 'USD',
      total: 10,
      receivedAt: null,
    });
    purchaseOrderPort.getPurchaseOrder.mockResolvedValue({ orderNumber: 'PO-1' });
    await expect(adapter.resolveModel({ grnId: 'grn-1' })).resolves.toEqual({
      grnNumber: 'GRN-1',
      purchaseOrderId: 'po-1',
      orderNumber: 'PO-1',
      vendorId: 'v-1',
      status: 'RECEIVED',
      currency: 'USD',
      total: 10,
      receivedAt: '',
    });
  });

  it('returns an empty model when no grnId is present', async () => {
    await expect(adapter.resolveModel({})).resolves.toEqual({});
    expect(getGrn.execute).not.toHaveBeenCalled();
  });

  it('returns an empty model when the GRN is missing', async () => {
    getGrn.execute.mockResolvedValue(null);
    await expect(adapter.resolveModel({ grnId: 'missing' })).resolves.toEqual({});
  });

  it('always resolves zero recipients', async () => {
    await expect(adapter.resolveRecipients(undefined, undefined)).resolves.toEqual([]);
  });
});
