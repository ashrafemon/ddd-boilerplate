import { Entity } from '../../../../../shared-business/domain/entity';
import { Money } from '../../../../../shared-business/value-object/money';
import { Quantity } from '../../../../../shared-business/value-object/quantity';
import { TaxRate } from '../../../../../shared-business/value-object/tax-rate';
import { createUuid } from '../../../../../shared-kernel/utilities/uuid';
import { Identifier } from '../../../../../shared-business/domain/identifier';
import { ProductReference } from '../../value-object/product-reference.vo';

export class PurchaseOrderLineId extends Identifier {
  public static from(value: string): PurchaseOrderLineId {
    return new PurchaseOrderLineId(value);
  }

  public static create(): PurchaseOrderLineId {
    return new PurchaseOrderLineId(createUuid());
  }
}

/**
 * A single line of a purchase order. Part of the PurchaseOrder aggregate: it
 * is only mutated through the aggregate root. Amounts are computed from
 * quantity, unit price and tax rate.
 */
export class PurchaseOrderLine extends Entity<PurchaseOrderLineId> {
  private readonly lineNumber: number;
  private readonly product: ProductReference;
  private readonly description: string;
  private quantity: Quantity;
  private unitPrice: Money;
  private taxRate: TaxRate;
  private readonly netAmount: Money;
  private readonly taxAmount: Money;
  private readonly totalAmount: Money;

  private constructor(
    id: PurchaseOrderLineId,
    lineNumber: number,
    product: ProductReference,
    description: string,
    quantity: Quantity,
    unitPrice: Money,
    taxRate: TaxRate,
  ) {
    super(id);
    this.lineNumber = lineNumber;
    this.product = product;
    this.description = description;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
    this.taxRate = taxRate;
    this.netAmount = unitPrice.multiplyBy(quantity.getValue());
    this.taxAmount = this.netAmount.multiplyBy(taxRate.getBasisPoints() / 10000);
    this.totalAmount = this.netAmount.add(this.taxAmount);
  }

  public static create(input: {
    lineNumber: number;
    product: ProductReference;
    description: string;
    quantity: Quantity;
    unitPrice: Money;
    taxRate?: TaxRate;
  }): PurchaseOrderLine {
    return new PurchaseOrderLine(
      PurchaseOrderLineId.create(),
      input.lineNumber,
      input.product,
      input.description,
      input.quantity,
      input.unitPrice,
      input.taxRate ?? TaxRate.zero(),
    );
  }

  public static reconstitute(
    id: PurchaseOrderLineId,
    lineNumber: number,
    product: ProductReference,
    description: string,
    quantity: Quantity,
    unitPrice: Money,
    taxRate: TaxRate,
  ): PurchaseOrderLine {
    return new PurchaseOrderLine(id, lineNumber, product, description, quantity, unitPrice, taxRate);
  }

  public getLineNumber(): number {
    return this.lineNumber;
  }

  public getProduct(): ProductReference {
    return this.product;
  }

  public getDescription(): string {
    return this.description;
  }

  public getQuantity(): Quantity {
    return this.quantity;
  }

  public getUnitPrice(): Money {
    return this.unitPrice;
  }

  public getTaxRate(): TaxRate {
    return this.taxRate;
  }

  public getNetAmount(): Money {
    return this.netAmount;
  }

  public getTaxAmount(): Money {
    return this.taxAmount;
  }

  public getTotalAmount(): Money {
    return this.totalAmount;
  }

  public changeQuantity(quantity: Quantity): void {
    this.quantity = quantity;
  }
}
