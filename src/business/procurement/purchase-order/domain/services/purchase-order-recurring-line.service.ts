import { PurchaseOrderInvariants } from '../aggregates/purchase-order.invariants';
import type { AddLineInput } from '../../domain/types/purchase-order.types';

export class PurchaseOrderRecurringLineService {
  static validateAndMap(lines: unknown[]): Omit<AddLineInput, 'id'>[] {
    PurchaseOrderInvariants.enforcePurchaseOrderHasLines(lines.length);

    return lines.map((raw, index) => {
      const line = raw as Record<string, unknown>;
      PurchaseOrderInvariants.enforceRecurringPoLineProductId(line, index);
      PurchaseOrderInvariants.enforceRecurringPoLineQuantity(line, index);
      PurchaseOrderInvariants.enforceRecurringPoLineUnitPrice(line, index);

      const productId = line.productId as string;
      const quantity = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity);
      const unitPrice =
        typeof line.unitPrice === 'number' ? line.unitPrice : Number(line.unitPrice);

      return { productId, quantity, unitPrice };
    });
  }
}
