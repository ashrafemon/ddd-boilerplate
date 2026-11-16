import { InvoicePosted } from './invoice.posted.event';
import { InvoiceId } from '../value-objects/invoice-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('InvoicePosted', () => {
  it('captures its payload as a domain event', () => {
    const event = new InvoicePosted(InvoiceId.fromString('inv-1'), 'INV-1', new Date('2026-01-01'));
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.invoiceNo).toBe('INV-1');
  });
});
