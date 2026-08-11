import { InvariantException } from '@business/shared-business/errors/invariant-violate.error';
import { PurchaseOrderStatus } from '../entities/purchase-order.aggregate';

/**
 * Purchase order invariants — rules that ALWAYS hold regardless of policy.
 */
export const PurchaseOrderInvariants = {
  assertHasLines(lineCount: number): void {
    if (lineCount < 1) {
      throw new InvariantException('Purchase order must contain at least one line');
    }
  },

  assertValidStatusTransition(from: PurchaseOrderStatus, to: PurchaseOrderStatus): void {
    if (from === to) {
      return;
    }

    const allowed: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
      [PurchaseOrderStatus.DRAFT]: [PurchaseOrderStatus.SUBMITTED, PurchaseOrderStatus.CANCELLED],
      [PurchaseOrderStatus.SUBMITTED]: [
        PurchaseOrderStatus.APPROVED,
        PurchaseOrderStatus.REJECTED,
        PurchaseOrderStatus.CANCELLED,
      ],
      [PurchaseOrderStatus.APPROVED]: [
        PurchaseOrderStatus.COMPLETED,
        PurchaseOrderStatus.CANCELLED,
      ],
      [PurchaseOrderStatus.REJECTED]: [],
      [PurchaseOrderStatus.CANCELLED]: [],
      [PurchaseOrderStatus.COMPLETED]: [],
    };

    if (!allowed[from].includes(to)) {
      throw new InvariantException(`Invalid purchase order transition: ${from} -> ${to}`);
    }
  },

  assertQuantityPositive(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new InvariantException('Line quantity must be a positive integer');
    }
  },

  assertPricesMatch(total, sumOfLines): void {
    if (total !== sumOfLines) {
      throw new InvariantException('Purchase order total must equal the sum of its lines');
    }
  },
} as const;
