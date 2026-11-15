import { VendorActivated } from './vendor.activated.event';
import { VendorId } from '../value-objects/vendor-id.vo';

describe('VendorActivated', () => {
  it('carries the vendor id', () => {
    const event = new VendorActivated(VendorId.fromString('vendor-1'));
    expect(event.vendorId.value).toBe('vendor-1');
    expect(event.eventId).toBeTruthy();
  });
});
