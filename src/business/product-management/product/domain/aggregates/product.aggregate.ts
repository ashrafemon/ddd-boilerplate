import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ProductId } from '../value-objects/product-id.vo';
import { ProductProps } from '../types/product.types';
import { ProductName } from '../value-objects/product-name.vo';
import { ProductStatus } from '../types/product.enum';
import { ProductInvariants } from './product.invariants';
import { ProductUpdated } from '../events/product.updated.event';
import { ProductActivated } from '../events/product.activated.event';
import { ProductDeactivated } from '../events/product.deactivated.event';
import { ProductDiscontinued } from '../events/product.discontinued.event';
import { ProductReactivationPolicy } from '../policies/reactivation.policy';

export class Product extends AggregateRoot<ProductId> {
  private props: ProductProps;

  private constructor(id: ProductId, props: ProductProps, version: number) {
    super(id);
    this.props = props;
    this.version = version;
  }

  /**
   * Construction entry point reserved for the domain factory. Enforces no
   * invariants here — the factory registers + enforces creation invariants.
   */
  static instantiate(id: ProductId, props: ProductProps, version: number): Product {
    return new Product(id, props, version);
  }

  get sku(): string {
    return this.props.sku.value;
  }

  get name(): string {
    return this.props.name.value;
  }

  get description(): string | null {
    return this.props.description;
  }

  get status(): ProductStatus {
    return this.props.status;
  }

  get unitPrice(): Money {
    return this.props.unitPrice;
  }

  get currency(): string {
    return this.props.currency;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isPurchasable(): boolean {
    return this.props.status === ProductStatus.ACTIVE;
  }

  update(input: { name?: string; description?: string }): void {
    if (input.name !== undefined) {
      this.props.name = ProductName.create(input.name);
    }
    if (input.description !== undefined) {
      this.props.description = input.description.trim() || null;
    }
    this.props.updatedAt = new Date();
    this.addEvent(new ProductUpdated(this.id));
  }

  changePrice(newPrice: Money): void {
    ProductInvariants.enforceProductPriceChange(newPrice.amount);
    this.props.unitPrice = newPrice;
    this.props.updatedAt = new Date();
    this.addEvent(new ProductUpdated(this.id));
  }

  activate(): void {
    if (!ProductReactivationPolicy.enforceProductReactivation(this.props.status)) {
      throw Object.assign(new Error('Product cannot be reactivated'), { statusCode: 422 });
    }
    ProductInvariants.enforceProductStatusTransition(this.props.status, ProductStatus.ACTIVE);

    this.props.status = ProductStatus.ACTIVE;
    this.props.updatedAt = new Date();
    this.addEvent(new ProductActivated(this.id));
  }

  deactivate(): void {
    ProductInvariants.enforceProductStatusTransition(this.props.status, ProductStatus.INACTIVE);
    this.props.status = ProductStatus.INACTIVE;
    this.props.updatedAt = new Date();
    this.addEvent(new ProductDeactivated(this.id));
  }

  discontinue(): void {
    ProductInvariants.enforceProductStatusTransition(this.props.status, ProductStatus.DISCONTINUED);
    this.props.status = ProductStatus.DISCONTINUED;
    this.props.updatedAt = new Date();
    this.addEvent(new ProductDiscontinued(this.id));
  }
}
