import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';

export class VendorDeactivatedIntegrationEvent {
  constructor(public readonly vendorId: VendorId) {}
}
