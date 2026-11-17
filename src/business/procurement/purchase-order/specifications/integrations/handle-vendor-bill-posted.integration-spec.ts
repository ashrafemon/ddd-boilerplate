import { HandleVendorBillPostedUseCase } from '@business/procurement/purchase-order/application/use-cases/handle-vendor-bill-posted.usecase';

describe('HandleVendorBillPostedUseCase (integration)', () => {
  it('acknowledges the bill and returns its number', async () => {
    const useCase = new HandleVendorBillPostedUseCase();
    const result = await useCase.execute({
      vendorId: 'vendor-1',
      billNumber: 'BILL-0001',
      amount: 500,
      currency: 'USD',
    });

    expect(result).toBe('BILL-0001');
  });

  it('returns the bill number when a purchase order is referenced', async () => {
    const useCase = new HandleVendorBillPostedUseCase();
    const result = await useCase.execute({
      vendorId: 'vendor-1',
      billNumber: 'BILL-0002',
      amount: 100,
      currency: 'USD',
      purchaseOrderId: 'po-1',
      lines: [{ productId: 'p1', quantity: 2, amount: 100 }],
    });

    expect(result).toBe('BILL-0002');
  });
});
