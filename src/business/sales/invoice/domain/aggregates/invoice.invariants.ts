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

invariantRegistry.register<{ lines: unknown[] }>('recurring-invoice-lines.create', {
  name: 'recurring-invoice-lines-required',
  check: ({ lines }) => {
    if (!Array.isArray(lines) || lines.length < 1) {
      throw Object.assign(new Error('Recurring Invoice template must have at least one line'), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{ line: unknown; index: number }>('recurring-invoice-line.description', {
  name: 'recurring-invoice-line-description-required',
  check: ({ line, index }) => {
    const record = line as Record<string, unknown>;
    const description = record?.description;
    if (typeof description !== 'string' || !description.trim()) {
      throw Object.assign(new Error(`Recurring Invoice lines[${index}].description is required`), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{ line: unknown; index: number }>('recurring-invoice-line.quantity', {
  name: 'recurring-invoice-line-quantity-number',
  check: ({ line, index }) => {
    const record = line as Record<string, unknown>;
    const quantity = record?.quantity;
    const numeric = typeof quantity === 'number' ? quantity : Number(quantity);
    if (!Number.isFinite(numeric)) {
      throw Object.assign(
        new Error(`Recurring Invoice lines[${index}].quantity must be a number`),
        { statusCode: 422 },
      );
    }
  },
});

invariantRegistry.register<{ line: unknown; index: number }>('recurring-invoice-line.unit-price', {
  name: 'recurring-invoice-line-unit-price-number',
  check: ({ line, index }) => {
    const record = line as Record<string, unknown>;
    const unitPrice = record?.unitPrice;
    const numeric = typeof unitPrice === 'number' ? unitPrice : Number(unitPrice);
    if (!Number.isFinite(numeric)) {
      throw Object.assign(
        new Error(`Recurring Invoice lines[${index}].unitPrice must be a number`),
        { statusCode: 422 },
      );
    }
  },
});
