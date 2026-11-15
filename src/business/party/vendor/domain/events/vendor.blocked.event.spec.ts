import { VendorBlocked } from './vendor.blocked.event';
import { VendorId } from '../value-objects/vendor-id.vo';

describe('VendorBlocked', () => {
  it('carries the vendor id', () => {
    const event = new VendorBlocked(VendorId.fromString('vendor-1'));
    expect(event.vendorId.value).toBe('vendor-1');
    expect(event.eventId).toBeTruthy();
  });
});
