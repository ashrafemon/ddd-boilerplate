import { NumberingAdapter } from './numbering.adapter';
import { NumberingPort } from '@platform/platform-common/numbering/inbound/ports/numbering.port';

describe('Invoice NumberingAdapter', () => {
  it('delegates number generation to the platform', async () => {
    const platform = { nextNumber: jest.fn().mockResolvedValue('PO-1') };
    const adapter = new NumberingAdapter(platform);
    await expect(adapter.nextNumber('purchase-order')).resolves.toBe('PO-1');
    expect(platform.nextNumber).toHaveBeenCalledWith('purchase-order', undefined);
    expect(adapter).toBeInstanceOf(NumberingAdapter);
    expect(platform as unknown as NumberingPort).toBeDefined();
  });
});
