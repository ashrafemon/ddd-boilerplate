import { OrderableVendorAdapter } from './orderable-vendor.adapter';

describe('PurchaseOrder OrderableVendorAdapter', () => {
  const port = {
    getOrderableVendor: jest.fn(),
    findOrderableVendorsByCodes: jest.fn(),
  };
  let adapter: OrderableVendorAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new OrderableVendorAdapter(port);
  });

  it('delegates getOrderableVendor', async () => {
    port.getOrderableVendor.mockResolvedValue({ id: 'v-1' });
    await expect(adapter.getOrderableVendor('v-1')).resolves.toEqual({ id: 'v-1' });
  });

  it('delegates findOrderableVendorsByCodes', async () => {
    port.findOrderableVendorsByCodes.mockResolvedValue([{ id: 'v-1' }]);
    await expect(adapter.findOrderableVendorsByCodes(['V1'])).resolves.toEqual([{ id: 'v-1' }]);
    expect(port.findOrderableVendorsByCodes).toHaveBeenCalledWith(['V1']);
  });
});
