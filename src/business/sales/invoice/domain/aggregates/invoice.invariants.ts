import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { InvoiceStatus } from '../types/invoice.enum';

invariantRegistry.register<{ lineCount: number }>('invoice.create', {
  name: 'invoice-has-lines',
  check: ({ lineCount }) => {
    if (lineCount < 1) {
      throw Object.assign(new Error('Invoice must have at least one line'), { statusCode: 422 });
    }
  },
});

invariantRegistry.register<{ quantity: number; unitPriceMinor: number }>('invoice.line', {
  name: 'invoice-line-amounts',
  check: ({ quantity, unitPriceMinor }) => {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(new Error('Invoice line quantity must be positive'), { statusCode: 422 });
    }
    if (unitPriceMinor < 0) {
      throw Object.assign(new Error('Invoice line price cannot be negative'), { statusCode: 422 });
    }
  },
});

invariantRegistry.register<{ status: InvoiceStatus; to: InvoiceStatus }>(
  'invoice.status-transition',
  {
    name: 'invoice-valid-status-transition',
    check: ({ status, to }) => {
      if (status === to) return;
      const allowed: Record<InvoiceStatus, InvoiceStatus[]> = {
        [InvoiceStatus.DRAFT]: [InvoiceStatus.POSTED, InvoiceStatus.CANCELLED],
        [InvoiceStatus.POSTED]: [InvoiceStatus.CANCELLED],
        [InvoiceStatus.CANCELLED]: [],
      };
      if (!allowed[status].includes(to)) {
        throw Object.assign(new Error(`Cannot transition invoice from ${status} to ${to}`), {
          statusCode: 422,
        });
      }
    },
  },
);
