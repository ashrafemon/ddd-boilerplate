import { InvoiceStatus } from '../types/invoice.enum';

export class InvoiceInvariants {
  static enforceInvoiceCreate(lineCount: number): void {
    if (lineCount < 1) {
      throw Object.assign(new Error('Invoice must have at least one line'), {
        statusCode: 422,
      });
    }
  }

  static enforceInvoiceLine(quantity: number, unitPriceMinor: number): void {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(new Error('Invoice line quantity must be positive'), {
        statusCode: 422,
      });
    }
    if (unitPriceMinor < 0) {
      throw Object.assign(new Error('Invoice line price cannot be negative'), {
        statusCode: 422,
      });
    }
  }

  static enforceInvoiceStatusTransition(status: InvoiceStatus, to: InvoiceStatus): void {
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
  }

  static enforceRecurringInvoiceLinesCreate(lines: unknown[]): void {
    if (!Array.isArray(lines) || lines.length < 1) {
      throw Object.assign(new Error('Recurring Invoice template must have at least one line'), {
        statusCode: 422,
      });
    }
  }

  static enforceRecurringInvoiceLineDescription(line: unknown, index: number): void {
    const record = line as Record<string, unknown>;
    const description = record?.description;
    if (typeof description !== 'string' || !description.trim()) {
      throw Object.assign(new Error(`Recurring Invoice lines[${index}].description is required`), {
        statusCode: 422,
      });
    }
  }

  static enforceRecurringInvoiceLineQuantity(line: unknown, index: number): void {
    const record = line as Record<string, unknown>;
    const quantity = record?.quantity;
    const numeric = typeof quantity === 'number' ? quantity : Number(quantity);
    if (!Number.isFinite(numeric)) {
      throw Object.assign(
        new Error(`Recurring Invoice lines[${index}].quantity must be a number`),
        { statusCode: 422 },
      );
    }
  }

  static enforceRecurringInvoiceLineUnitPrice(line: unknown, index: number): void {
    const record = line as Record<string, unknown>;
    const unitPrice = record?.unitPrice;
    const numeric = typeof unitPrice === 'number' ? unitPrice : Number(unitPrice);
    if (!Number.isFinite(numeric)) {
      throw Object.assign(
        new Error(`Recurring Invoice lines[${index}].unitPrice must be a number`),
        { statusCode: 422 },
      );
    }
  }
}
