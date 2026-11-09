import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { JournalEntryId } from '../value-objects';

export class JournalEntryRecorded extends DomainEvent {
  constructor(
    public readonly journalEntryId: JournalEntryId,
    public readonly entryNo: string,
    public readonly status: string,
  ) {
    super();
  }
}

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

export class PaymentCompleted extends DomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly amount: number,
    public readonly currency: string,
  ) {
    super();
  }
}
