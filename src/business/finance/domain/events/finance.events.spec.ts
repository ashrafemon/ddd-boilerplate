import { JournalEntryId } from '../value-objects/journal-entry-id.vo';
import { JournalEntryRecorded } from './journal-entry-recorded.event';
import { PaymentCompleted } from './payment-completed.event';
import { VendorBillPosted } from './vendor-bill-posted.event';

describe('Finance domain events', () => {
  it('JournalEntryRecorded carries the entry no and status', () => {
    const event = new JournalEntryRecorded(JournalEntryId.fromString('je-1'), 'JE-0001', 'POSTED');
    expect(event.entryNo).toBe('JE-0001');
    expect(event.status).toBe('POSTED');
    expect(event.eventId).toBeTruthy();
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.version).toBe(1);
  });

  it('PaymentCompleted carries amount and currency', () => {
    const event = new PaymentCompleted('pay-1', 250, 'USD');
    expect(event.paymentId).toBe('pay-1');
    expect(event.amount).toBe(250);
    expect(event.currency).toBe('USD');
  });

  it('VendorBillPosted carries vendor and amount', () => {
    const event = new VendorBillPosted('bill-1', 'vendor-1', 500, 'EUR');
    expect(event.vendorBillId).toBe('bill-1');
    expect(event.vendorId).toBe('vendor-1');
    expect(event.amount).toBe(500);
    expect(event.currency).toBe('EUR');
  });
});
