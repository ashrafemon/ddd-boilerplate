import { VendorCreated } from './vendor.created.event';
import { VendorId } from '../value-objects/vendor-id.vo';

describe('VendorCreated', () => {
  it('carries the vendor id, code and name', () => {
    const id = VendorId.fromString('vendor-1');
    const event = new VendorCreated(id, 'VEN-100', 'Acme');

    expect(event.vendorId.value).toBe('vendor-1');
    expect(event.code).toBe('VEN-100');
    expect(event.name).toBe('Acme');
  });

  it('is a domain event with generated metadata', () => {
    const event = new VendorCreated(VendorId.fromString('v'), 'VEN-1', 'Acme');
    expect(event.eventId).toBeTruthy();
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.version).toBe(1);
  });
});
