import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';

export class VendorCreatedIntegrationEvent {
  constructor(
    public eventId: string,
    public eventType: 'vendor.created',
    public occurredAt: string,
    public readonly vendorId: VendorId,
    public readonly code: string,
    public readonly name: string,
    public readonly email: string | null,
    public readonly phone: string | null,
    public readonly address: string | null,
  ) {}
}
