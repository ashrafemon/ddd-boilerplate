import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';

export class VendorBlockedIntegrationEvent {
  constructor(public readonly vendorId: VendorId) {}
}
