import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

interface InvoiceNumberProps {
  value: string;
}

/**
 * Invoice document number VO. Normalizes to uppercase and enforces the
 * `INV-<digits>` shape registered in `invoice-number.invariants.ts`.
 */
export class InvoiceNumber extends ValueObject<InvoiceNumberProps> {
  private constructor(props: InvoiceNumberProps) {
    super(props);
  }

  static create(value: string): InvoiceNumber {
    const normalized = value.trim().toUpperCase();
    invariantRegistry.enforce<{ invoiceNo: string }>('invoice-number.create', {
      invoiceNo: normalized,
    });
    return new InvoiceNumber({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
