import { VendorDeactivated } from './vendor.deactivated.event';
import { VendorId } from '../value-objects/vendor-id.vo';

describe('VendorDeactivated', () => {
  it('carries the vendor id', () => {
    const event = new VendorDeactivated(VendorId.fromString('vendor-1'));
    expect(event.vendorId.value).toBe('vendor-1');
    expect(event.eventId).toBeTruthy();
  });
});
