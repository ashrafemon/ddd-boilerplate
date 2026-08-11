import { DomainException } from '../../../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../../../../shared-business/domain/value-object';

interface PurchaseOrderNumberProps {
  value: string;
}

/**
 * Human-readable purchase order number, e.g. PO-2026-0001.
 */
export class PurchaseOrderNumber extends ValueObject<PurchaseOrderNumberProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static from(value: string): PurchaseOrderNumber {
    const normalized = value?.trim().toUpperCase();
    if (!normalized || !/^[A-Z0-9-]{3,32}$/.test(normalized)) {
      throw new DomainException(`Invalid purchase order number: ${String(value)}`, 'INVALID_PO_NUMBER');
    }
    return new PurchaseOrderNumber(normalized);
  }

  public getValue(): string {
    return this.props.value;
  }
}
