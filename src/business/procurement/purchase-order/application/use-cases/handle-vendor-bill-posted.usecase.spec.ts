import { HandleVendorBillPostedUseCase } from './handle-vendor-bill-posted.usecase';

describe('HandleVendorBillPostedUseCase', () => {
  it('acknowledges the vendor bill and returns its number', async () => {
    const usecase = new HandleVendorBillPostedUseCase();
    await expect(
      usecase.execute({
        vendorId: 'v-1',
        billNumber: 'BILL-100',
        amount: 10,
        currency: 'USD',
      }),
    ).resolves.toBe('BILL-100');
  });
});
