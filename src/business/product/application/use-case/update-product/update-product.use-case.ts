import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { Money } from '../../../../../shared-business/value-object/money';
import { OrganizationId } from '../../../../../shared-business/value-object/organization-id';
import { Sku } from '../../../../../shared-business/value-object/sku';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { Currency } from '../../../../../shared-business/value-object/currency';
import { ProductId } from '../../../domain/aggregate/product/product-id.vo';
import { OutboxPort } from '../../../domain/port/outbox.port';
import { ProductPersistenceData, ProductWriteRepositoryPort } from '../../../domain/port/product-write-repository.port';
import { ProductUnit } from '../../../domain/value-object/product-unit.vo';
import { UpdateProductInput, UpdateProductOutput } from '../../type/update-product.input';
import { UpdateProductPort } from '../../port/update-product.port';

/**
 * Updates a product inside a transaction.
 */
@Injectable()
export class UpdateProductUseCase implements UpdateProductPort {
  constructor(
    private readonly writeRepository: ProductWriteRepositoryPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: UpdateProductInput): Promise<UpdateProductOutput> {
    const tenantId = this.requireTenantId();
    const organizationId = this.requireOrganizationId();

    const product = await this.writeRepository.findById(ProductId.from(input.productId));
    if (!product || !product.getTenantId().equals(tenantId)) {
      throw new AggregateNotFoundException('Product', input.productId);
    }

    product.updateProfile({
      name: input.name,
      description: input.description,
      sku: input.sku !== undefined ? Sku.from(input.sku) : undefined,
      unit: input.unit !== undefined ? ProductUnit.from(input.unit) : undefined,
      price:
        input.priceCents !== undefined
          ? Money.from(input.priceCents, Currency.from(input.currency ?? 'USD'))
          : undefined,
      isPurchasable: input.isPurchasable,
      isSellable: input.isSellable,
      categoryId: input.categoryId,
    });

    const data: ProductPersistenceData = {
      operation: 'update',
      id: input.productId,
      name: input.name,
      description: input.description,
      sku: input.sku,
      unit: input.unit,
      priceCents: input.priceCents,
      currency: input.currency,
      isPurchasable: input.isPurchasable,
      isSellable: input.isSellable,
      categoryId: input.categoryId,
    };
    await this.writeRepository.save(data);

    await this.outbox.appendMany(
      product.pullDomainEvents().map((event) =>
        event.toOutboxEventInput({
          tenantId: tenantId.getValue(),
          organizationId: organizationId.getValue(),
          correlationId: this.requestContext.getCorrelationId(),
        }),
      ),
    );

    return { productId: input.productId, updatedAt: new Date() };
  }

  private requireTenantId(): TenantId {
    const value = this.requestContext.getTenantId();
    if (!value) throw new UnauthorizedException('Tenant context is required');
    return TenantId.from(value);
  }

  private requireOrganizationId(): OrganizationId {
    const value = this.requestContext.getOrganizationId();
    if (!value) throw new UnauthorizedException('Organization context is required');
    return OrganizationId.from(value);
  }
}
