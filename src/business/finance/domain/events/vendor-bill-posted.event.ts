import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

export class VendorBillPosted extends DomainEvent {
  constructor(
    public readonly vendorBillId: string,
    public readonly vendorId: string,
    public readonly amount: number,
    public readonly currency: string,
  ) {
    super();
  }
}
