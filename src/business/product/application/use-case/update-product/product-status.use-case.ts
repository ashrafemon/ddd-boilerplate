import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { ProductId } from '../../../domain/aggregate/product/product-id.vo';
import { OutboxPort } from '../../../domain/port/outbox.port';
import { ProductPersistenceData, ProductWriteRepositoryPort } from '../../../domain/port/product-write-repository.port';
import { ProductStatusValue } from '../../../domain/value-object/product-status.vo';
import { ActivateProductInput, ActivateProductOutput, DeactivateProductInput, DeactivateProductOutput } from '../../type/update-product.input';
import { ActivateProductPort, DeactivateProductPort } from '../../port/update-product.port';

/**
 * Activates a product inside a transaction.
 */
@Injectable()
export class ActivateProductUseCase implements ActivateProductPort {
  constructor(
    private readonly writeRepository: ProductWriteRepositoryPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: ActivateProductInput): Promise<ActivateProductOutput> {
    const tenantId = this.requireTenantId();

    const product = await this.writeRepository.findById(ProductId.from(input.productId));
    if (!product || !product.getTenantId().equals(tenantId)) {
      throw new AggregateNotFoundException('Product', input.productId);
    }

    product.activate();
    const data: ProductPersistenceData = {
      operation: 'update',
      id: input.productId,
      status: ProductStatusValue.ACTIVE,
    };
    await this.writeRepository.save(data);

    await this.outbox.appendMany(
      product.pullDomainEvents().map((event) =>
        event.toOutboxEventInput({
          tenantId: tenantId.getValue(),
          organizationId: this.requestContext.getOrganizationId(),
          correlationId: this.requestContext.getCorrelationId(),
        }),
      ),
    );

    return { productId: input.productId, status: 'ACTIVE' };
  }

  private requireTenantId(): TenantId {
    const value = this.requestContext.getTenantId();
    if (!value) throw new UnauthorizedException('Tenant context is required');
    return TenantId.from(value);
  }
}

/**
 * Deactivates a product inside a transaction.
 */
@Injectable()
export class DeactivateProductUseCase implements DeactivateProductPort {
  constructor(
    private readonly writeRepository: ProductWriteRepositoryPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: DeactivateProductInput): Promise<DeactivateProductOutput> {
    const tenantId = this.requireTenantId();

    const product = await this.writeRepository.findById(ProductId.from(input.productId));
    if (!product || !product.getTenantId().equals(tenantId)) {
      throw new AggregateNotFoundException('Product', input.productId);
    }

    product.deactivate();
    const data: ProductPersistenceData = {
      operation: 'update',
      id: input.productId,
      status: ProductStatusValue.INACTIVE,
    };
    await this.writeRepository.save(data);

    await this.outbox.appendMany(
      product.pullDomainEvents().map((event) =>
        event.toOutboxEventInput({
          tenantId: tenantId.getValue(),
          organizationId: this.requestContext.getOrganizationId(),
          correlationId: this.requestContext.getCorrelationId(),
        }),
      ),
    );

    return { productId: input.productId, status: 'INACTIVE' };
  }

  private requireTenantId(): TenantId {
    const value = this.requestContext.getTenantId();
    if (!value) throw new UnauthorizedException('Tenant context is required');
    return TenantId.from(value);
  }
}
