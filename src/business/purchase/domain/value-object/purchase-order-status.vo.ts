import { DomainException } from '../../../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../../../../shared-business/domain/value-object';

export enum PurchaseOrderStatusValue {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

interface PurchaseOrderStatusProps {
  value: PurchaseOrderStatusValue;
}

export const PURCHASE_ORDER_TRANSITIONS: Record<PurchaseOrderStatusValue, PurchaseOrderStatusValue[]> = {
  [PurchaseOrderStatusValue.DRAFT]: [
    PurchaseOrderStatusValue.SUBMITTED,
    PurchaseOrderStatusValue.CANCELLED,
  ],
  [PurchaseOrderStatusValue.SUBMITTED]: [
    PurchaseOrderStatusValue.APPROVED,
    PurchaseOrderStatusValue.REJECTED,
    PurchaseOrderStatusValue.CANCELLED,
  ],
  [PurchaseOrderStatusValue.APPROVED]: [PurchaseOrderStatusValue.COMPLETED],
  [PurchaseOrderStatusValue.REJECTED]: [],
  [PurchaseOrderStatusValue.CANCELLED]: [],
  [PurchaseOrderStatusValue.COMPLETED]: [],
};

/**
 * Lifecycle status of a purchase order.
 */
export class PurchaseOrderStatus extends ValueObject<PurchaseOrderStatusProps> {
  private constructor(value: PurchaseOrderStatusValue) {
    super({ value });
  }

  public static from(value: string): PurchaseOrderStatus {
    if (!Object.values(PurchaseOrderStatusValue).includes(value as PurchaseOrderStatusValue)) {
      throw new DomainException(`Invalid purchase order status: ${String(value)}`, 'INVALID_PO_STATUS');
    }
    return new PurchaseOrderStatus(value as PurchaseOrderStatusValue);
  }

  public static draft(): PurchaseOrderStatus {
    return new PurchaseOrderStatus(PurchaseOrderStatusValue.DRAFT);
  }

  public static submitted(): PurchaseOrderStatus {
    return new PurchaseOrderStatus(PurchaseOrderStatusValue.SUBMITTED);
  }

  public static approved(): PurchaseOrderStatus {
    return new PurchaseOrderStatus(PurchaseOrderStatusValue.APPROVED);
  }

  public static rejected(): PurchaseOrderStatus {
    return new PurchaseOrderStatus(PurchaseOrderStatusValue.REJECTED);
  }

  public static cancelled(): PurchaseOrderStatus {
    return new PurchaseOrderStatus(PurchaseOrderStatusValue.CANCELLED);
  }

  public static completed(): PurchaseOrderStatus {
    return new PurchaseOrderStatus(PurchaseOrderStatusValue.COMPLETED);
  }

  public getValue(): PurchaseOrderStatusValue {
    return this.props.value;
  }

  public canTransitionTo(target: PurchaseOrderStatusValue): boolean {
    return (PURCHASE_ORDER_TRANSITIONS[this.props.value] ?? []).includes(target);
  }
}
