import { VendorUpdated } from './vendor.updated.event';
import { VendorId } from '../value-objects/vendor-id.vo';

describe('VendorUpdated', () => {
  it('carries the vendor id', () => {
    const event = new VendorUpdated(VendorId.fromString('vendor-1'));
    expect(event.vendorId.value).toBe('vendor-1');
    expect(event.eventId).toBeTruthy();
  });
});
