import { domainEventRegistry } from '@business/shared-business/domain/registries/domain-event.registry';
import { InvoiceId } from '../value-objects/invoice-id.vo';
import { InvoiceCreated } from './invoice.created.event';
import { InvoicePosted } from './invoice.posted.event';

domainEventRegistry.register('InvoiceCreated', payload => {
  const p = payload as unknown as {
    invoiceId: { value: string };
    invoiceNo: string;
    customerId: string;
    totalAmount: number;
    currency: string;
  };
  return new InvoiceCreated(
    InvoiceId.fromString(p.invoiceId.value),
    p.invoiceNo,
    p.customerId,
    p.totalAmount,
    p.currency,
  );
});

domainEventRegistry.register('InvoicePosted', payload => {
  const p = payload as unknown as {
    invoiceId: { value: string };
    invoiceNo: string;
    postedAt: string;
  };
  return new InvoicePosted(
    InvoiceId.fromString(p.invoiceId.value),
    p.invoiceNo,
    new Date(p.postedAt),
  );
});
