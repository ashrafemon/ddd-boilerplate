import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import type { AddLineInput } from '../../domain/types/purchase-order.types';

export class PurchaseOrderRecurringLineService {
  static validateAndMap(lines: unknown[]): Omit<AddLineInput, 'id'>[] {
    invariantRegistry.enforce('recurring-po-lines.create', { lines });

    return lines.map((raw, index) => {
      const line = raw as Record<string, unknown>;
      invariantRegistry.enforce('recurring-po-line.product-id', { line, index });
      invariantRegistry.enforce('recurring-po-line.quantity', { line, index });
      invariantRegistry.enforce('recurring-po-line.unit-price', { line, index });

      const productId = line.productId as string;
      const quantity = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity);
      const unitPrice =
        typeof line.unitPrice === 'number' ? line.unitPrice : Number(line.unitPrice);

      return { productId, quantity, unitPrice };
    });
  }
}
