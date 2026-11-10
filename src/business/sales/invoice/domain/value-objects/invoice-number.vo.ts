import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';
import { InvoiceNumberInvariants } from './invoice-number.invariants';

interface InvoiceNumberProps {
  value: string;
}

/**
 * Invoice document number VO. Normalizes to uppercase and enforces the
 * `INV-<digits>` shape enforced in `invoice-number.invariants.ts`.
 */
export class InvoiceNumber extends ValueObject<InvoiceNumberProps> {
  private constructor(props: InvoiceNumberProps) {
    super(props);
  }

  static create(value: string): InvoiceNumber {
    const normalized = value.trim().toUpperCase();
    InvoiceNumberInvariants.enforceInvoiceNumberFormat(normalized);
    return new InvoiceNumber({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
