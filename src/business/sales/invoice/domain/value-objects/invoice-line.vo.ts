import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';
import { Money } from '@business/shared-business/domain/common/value-objects/money';

export interface InvoiceLineProps {
  description: string;
  quantity: number;
  unitPrice: Money;
}

/**
 * Invoice line — a value object (no identity): lines live in the aggregate's
 * JSON column and are only ever rewritten as a whole.
 */
export class InvoiceLine extends ValueObject<InvoiceLineProps> {
  private constructor(props: InvoiceLineProps) {
    super(props);
  }

  static create(description: string, quantity: number, unitPrice: Money): InvoiceLine {
    return new InvoiceLine({
      description: description.trim(),
      quantity,
      unitPrice,
    });
  }

  get description(): string {
    return this.props.description;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get unitPrice(): Money {
    return this.props.unitPrice;
  }

  total(): Money {
    return this.props.unitPrice.multiply(this.props.quantity);
  }
}
