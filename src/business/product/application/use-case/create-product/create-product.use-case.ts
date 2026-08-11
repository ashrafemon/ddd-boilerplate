import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ConflictException } from '../../../../../shared-kernel/exceptions/conflict.exception';
import { OrganizationId } from '../../../../../shared-business/value-object/organization-id';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { OutboxPort } from '../../../domain/port/outbox.port';
import { ProductPersistenceData, ProductWriteRepositoryPort } from '../../../domain/port/product-write-repository.port';
import { ProductBuilder } from '../../../domain/service/product-builder.service';
import { ProductIdentityInvariant } from '../../../domain/invariant/product-identity.invariant';
import { InvariantRegistry } from '../../../../../shared-business/invariant/invariant-registry';
import { ProductId } from '../../../domain/aggregate/product/product-id.vo';
import { ProductStatusValue } from '../../../domain/value-object/product-status.vo';
import { Sku } from '../../../../../shared-business/value-object/sku';
import { createUuid } from '../../../../../shared-kernel/utilities/uuid';
import { CreateProductInput, CreateProductOutput } from '../../type/create-product.input';
import { CreateProductPort } from '../../port/create-product.port';

/**
 * Creates a new Product aggregate together with its outbox events in one
 * transaction.
 */
@Injectable()
export class CreateProductUseCase implements CreateProductPort {
  constructor(
    private readonly builder: ProductBuilder,
    private readonly writeRepository: ProductWriteRepositoryPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: CreateProductInput): Promise<CreateProductOutput> {
    const tenantId = this.requireTenantId();
    const organizationId = this.requireOrganizationId();

    InvariantRegistry.create()
      .add(new ProductIdentityInvariant())
      .enforceAll({
        name: input.name,
        skuValue: input.sku,
        code: input.code,
      });

    const existing = await this.writeRepository.findByCode(
      tenantId.getValue(),
      organizationId.getValue(),
      input.code,
    );
    if (existing) {
      throw new ConflictException(`Product with code "${input.code}" already exists`, {
        productId: existing.getId().getValue(),
      });
    }

    const productId = createUuid();
    const product = this.builder.create({
      id: ProductId.from(productId),
      tenantId,
      organizationId,
      ...input,
    });

    const data: ProductPersistenceData = {
      operation: 'create',
      id: productId,
      tenantId: tenantId.getValue(),
      organizationId: organizationId.getValue(),
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description ?? null,
      sku: Sku.from(input.sku).getValue(),
      unit: input.unit,
      status: ProductStatusValue.ACTIVE,
      isPurchasable: input.isPurchasable ?? true,
      isSellable: input.isSellable ?? true,
      priceCents: input.priceCents,
      currency: input.currency,
      categoryId: input.categoryId ?? null,
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

    return { productId };
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
