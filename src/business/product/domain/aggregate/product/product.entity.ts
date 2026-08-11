import { AggregateRoot } from '../../../../../shared-business/domain/aggregate-root';
import { Money } from '../../../../../shared-business/value-object/money';
import { OrganizationId } from '../../../../../shared-business/value-object/organization-id';
import { Sku } from '../../../../../shared-business/value-object/sku';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { ConflictException } from '../../../../../shared-kernel/exceptions/conflict.exception';
import { ProductCreatedEvent } from '../../event/product-created.event';
import { ProductActivatedEvent, ProductDeactivatedEvent } from '../../event/product-status.event';
import { ProductUpdatedEvent } from '../../event/product-updated.event';
import { ProductStatus, ProductStatusValue } from '../../value-object/product-status.vo';
import { ProductUnit } from '../../value-object/product-unit.vo';
import { ProductId } from './product-id.vo';

export interface ProductSnapshot {
  id: ProductId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  code: string;
  name: string;
  description?: string;
  sku: Sku;
  unit: ProductUnit;
  status: ProductStatus;
  isPurchasable: boolean;
  isSellable: boolean;
  price: Money;
  categoryId?: string;
}

/**
 * Product aggregate root.
 */
export class Product extends AggregateRoot<ProductId> {
  private readonly tenantId: TenantId;
  private readonly organizationId: OrganizationId;
  private code!: string;
  private name!: string;
  private description?: string;
  private sku!: Sku;
  private unit!: ProductUnit;
  private status!: ProductStatus;
  private isPurchasable!: boolean;
  private isSellable!: boolean;
  private price!: Money;
  private categoryId?: string;

  private constructor(id: ProductId, tenantId: TenantId, organizationId: OrganizationId) {
    super(id);
    this.tenantId = tenantId;
    this.organizationId = organizationId;
  }

  public static create(input: {
    id: ProductId;
    tenantId: TenantId;
    organizationId: OrganizationId;
    code: string;
    name: string;
    description?: string;
    sku: Sku;
    unit: ProductUnit;
    status?: ProductStatus;
    isPurchasable?: boolean;
    isSellable?: boolean;
    price: Money;
    categoryId?: string;
  }): Product {
    const product = new Product(input.id, input.tenantId, input.organizationId);
    product.code = input.code;
    product.name = input.name;
    product.description = input.description;
    product.sku = input.sku;
    product.unit = input.unit;
    product.status = input.status ?? ProductStatus.active();
    product.isPurchasable = input.isPurchasable ?? true;
    product.isSellable = input.isSellable ?? true;
    product.price = input.price;
    product.categoryId = input.categoryId;
    return product;
  }

  public static reconstitute(snapshot: ProductSnapshot): Product {
    const product = new Product(snapshot.id, snapshot.tenantId, snapshot.organizationId);
    product.name = snapshot.name;
    product.description = snapshot.description;
    product.sku = snapshot.sku;
    product.unit = snapshot.unit;
    product.status = snapshot.status;
    product.isPurchasable = snapshot.isPurchasable;
    product.isSellable = snapshot.isSellable;
    product.price = snapshot.price;
    product.categoryId = snapshot.categoryId;
    product.clearDomainEvents();
    return product;
  }

  public getTenantId(): TenantId {
    return this.tenantId;
  }

  public getOrganizationId(): OrganizationId {
    return this.organizationId;
  }

  public getCode(): string {
    return this.code;
  }

  public getName(): string {
    return this.name;
  }

  public getSku(): Sku {
    return this.sku;
  }

  public getUnit(): ProductUnit {
    return this.unit;
  }

  public getStatus(): ProductStatus {
    return this.status;
  }

  public isActive(): boolean {
    return this.status.isActive();
  }

  public isPurchasableProduct(): boolean {
    return this.isPurchasable;
  }

  public getPrice(): Money {
    return this.price;
  }

  public getDescription(): string | undefined {
    return this.description;
  }

  public isSellableProduct(): boolean {
    return this.isSellable;
  }

  public getCategoryId(): string | undefined {
    return this.categoryId;
  }

  public activate(): void {
    this.assertCanTransitionTo(ProductStatusValue.ACTIVE);
    this.status = ProductStatus.active();
    this.recordDomainEvent(new ProductActivatedEvent(this.getId().getValue()));
  }

  public deactivate(): void {
    this.assertCanTransitionTo(ProductStatusValue.INACTIVE);
    this.status = ProductStatus.inactive();
    this.recordDomainEvent(new ProductDeactivatedEvent(this.getId().getValue()));
  }

  public updateProfile(input: {
    name?: string;
    description?: string;
    sku?: Sku;
    unit?: ProductUnit;
    isPurchasable?: boolean;
    isSellable?: boolean;
    price?: Money;
    categoryId?: string;
  }): void {
    if (input.name !== undefined && input.name.trim().length > 0) this.name = input.name;
    if (input.description !== undefined) this.description = input.description;
    if (input.sku !== undefined) this.sku = input.sku;
    if (input.unit !== undefined) this.unit = input.unit;
    if (input.isPurchasable !== undefined) this.isPurchasable = input.isPurchasable;
    if (input.isSellable !== undefined) this.isSellable = input.isSellable;
    if (input.price !== undefined) this.price = input.price;
    if (input.categoryId !== undefined) this.categoryId = input.categoryId;
    this.recordDomainEvent(new ProductUpdatedEvent(this.getId().getValue()));
  }

  public markCreated(): void {
    this.recordDomainEvent(new ProductCreatedEvent(this.getId().getValue(), this.code));
  }

  private assertCanTransitionTo(target: ProductStatusValue): void {
    if (!this.status.canTransitionTo(target)) {
      throw new ConflictException(
        `Cannot transition product status from ${this.status.getValue()} to ${target}`,
      );
    }
  }
}
