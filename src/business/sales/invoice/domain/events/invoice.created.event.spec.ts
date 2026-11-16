import { InvoiceCreated } from './invoice.created.event';
import { InvoiceId } from '../value-objects/invoice-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('InvoiceCreated', () => {
  it('captures its payload as a domain event', () => {
    const event = new InvoiceCreated(InvoiceId.fromString('inv-1'), 'INV-1', 'c-1', 10, 'USD');
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.invoiceNo).toBe('INV-1');
    expect(event.totalAmount).toBe(10);
  });
});
