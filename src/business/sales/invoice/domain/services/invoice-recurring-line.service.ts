import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import type { InvoiceLineInput } from '../../domain/types/invoice.types';

export class InvoiceRecurringLineService {
  static validateAndMap(lines: unknown[]): InvoiceLineInput[] {
    invariantRegistry.enforce('recurring-invoice-lines.create', { lines });

    return lines.map((raw, index) => {
      const line = raw as Record<string, unknown>;
      invariantRegistry.enforce('recurring-invoice-line.description', { line, index });
      invariantRegistry.enforce('recurring-invoice-line.quantity', { line, index });
      invariantRegistry.enforce('recurring-invoice-line.unit-price', { line, index });

      const description = line.description as string;
      const quantity = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity);
      const unitPrice =
        typeof line.unitPrice === 'number' ? line.unitPrice : Number(line.unitPrice);

      return { description, quantity, unitPrice };
    });
  }
}
