import { AggregateRoot } from '@business/shared-business/domain/bases/aggregate.base';
import { Money } from '@business/shared-business/domain/money.value-object';
import { ProductId } from '../value-objects/product-id.vo';
import { Sku } from '../value-objects/sku.vo';
import { ProductName } from '../value-objects/product-name.vo';
import { ProductInvariants } from '../invariants/product.invariants';
import { ProductPolicy } from '../policies/product.policy';
import { ProductPolicyViolation } from '../errors/product-policy.error';
import {
  ProductActivated,
  ProductCreated,
  ProductDeactivated,
  ProductDiscontinued,
  ProductUpdated,
} from '../events/product.events';

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISCONTINUED = 'DISCONTINUED',
}

export interface ProductProps {
  sku: Sku;
  name: ProductName;
  description: string | null;
  status: ProductStatus;
  unitPrice: Money;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  unitPrice: Money;
  currency?: string;
}

export class Product extends AggregateRoot<ProductId> {
  private props: ProductProps;

  private constructor(id: ProductId, props: ProductProps, version: number) {
    super(id);
    this.props = props;
    this.version = version;
  }

  static create(input: CreateProductInput): Product {
    const now = new Date();
    const product = new Product(
      ProductId.generate(),
      {
        sku: Sku.create(input.sku),
        name: ProductName.create(input.name),
        description: input.description?.trim() || null,
        status: ProductStatus.ACTIVE,
        unitPrice: input.unitPrice,
        currency: input.currency ?? 'USD',
        createdAt: now,
        updatedAt: now,
      },
      1,
    );
    product.addEvent(
      new ProductCreated(
        product.id,
        product.props.sku.value,
        product.props.name.value,
        product.props.unitPrice,
        product.props.currency,
      ),
    );
    return product;
  }

  static reconstitute(id: ProductId, props: ProductProps, version: number): Product {
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
    this.props.unitPrice = newPrice;
    this.props.updatedAt = new Date();
    this.addEvent(new ProductUpdated(this.id));
  }

  activate(): void {
    const policy = ProductPolicy.default();
    const result = policy.evaluateReactivation({ status: this.props.status });
    if (!result.ok) {
      throw new ProductPolicyViolation(result.error);
    }

    ProductInvariants.assertValidStatusTransition(this.props.status, ProductStatus.ACTIVE);
    this.props.status = ProductStatus.ACTIVE;
    this.props.updatedAt = new Date();
    this.addEvent(new ProductActivated(this.id));
  }

  deactivate(): void {
    ProductInvariants.assertValidStatusTransition(this.props.status, ProductStatus.INACTIVE);
    this.props.status = ProductStatus.INACTIVE;
    this.props.updatedAt = new Date();
    this.addEvent(new ProductDeactivated(this.id));
  }

  discontinue(): void {
    ProductInvariants.assertValidStatusTransition(this.props.status, ProductStatus.DISCONTINUED);
    this.props.status = ProductStatus.DISCONTINUED;
    this.props.updatedAt = new Date();
    this.addEvent(new ProductDiscontinued(this.id));
  }
}
