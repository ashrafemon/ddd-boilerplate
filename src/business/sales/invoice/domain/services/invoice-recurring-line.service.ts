import type { InvoiceLineInput } from '../../domain/types/invoice.types';

export class InvoiceRecurringLineService {
  static validateAndMap(lines: unknown[]): InvoiceLineInput[] {
    const enforceInvoiceLineQuantity = (line: unknown, index: number): void => {
      const record = line as Record<string, unknown>;
      const quantity = record?.quantity;
      const numeric = typeof quantity === 'number' ? quantity : Number(quantity);
      if (!Number.isFinite(numeric)) {
        throw Object.assign(
          new Error(`Recurring Invoice lines[${index}].quantity must be a number`),
          { statusCode: 422 },
        );
      }
    };

    const enforceInvoiceLineUnitPrice = (line: unknown, index: number): void => {
      const record = line as Record<string, unknown>;
      const unitPrice = record?.unitPrice;
      const numeric = typeof unitPrice === 'number' ? unitPrice : Number(unitPrice);
      if (!Number.isFinite(numeric)) {
        throw Object.assign(
          new Error(`Recurring Invoice lines[${index}].unitPrice must be a number`),
          { statusCode: 422 },
        );
      }
    };

    if (!Array.isArray(lines) || lines.length < 1) {
      throw Object.assign(new Error('Recurring Invoice template must have at least one line'), {
        statusCode: 422,
      });
    }

    return lines.map((raw, index) => {
      const line = raw as Record<string, unknown>;
      const description = line.description as string;
      if (typeof description !== 'string' || !description.trim()) {
        throw Object.assign(
          new Error(`Recurring Invoice lines[${index}].description is required`),
          { statusCode: 422 },
        );
      }
      enforceInvoiceLineQuantity(line, index);
      enforceInvoiceLineUnitPrice(line, index);

      const quantity = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity);
      const unitPrice =
        typeof line.unitPrice === 'number' ? line.unitPrice : Number(line.unitPrice);

      return { description, quantity, unitPrice };
    });
  }
}
