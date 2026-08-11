import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { VendorId } from '../../../domain/aggregate/vendor/vendor-id.vo';
import { OutboxPort } from '../../../domain/port/outbox.port';
import { VendorPersistenceData, VendorWriteRepositoryPort } from '../../../domain/port/vendor-write-repository.port';
import { VendorStatusValue } from '../../../domain/value-object/vendor-status.vo';
import { DeactivateVendorInput, DeactivateVendorOutput } from '../../type/vendor-status.input';
import { DeactivateVendorPort } from '../../port/activate-vendor.port';

/**
 * Deactivates a vendor inside a transaction.
 */
@Injectable()
export class DeactivateVendorUseCase implements DeactivateVendorPort {
  constructor(
    private readonly writeRepository: VendorWriteRepositoryPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: DeactivateVendorInput): Promise<DeactivateVendorOutput> {
    const tenantId = this.requireTenantId();

    const vendor = await this.writeRepository.findById(VendorId.from(input.vendorId));
    if (!vendor || !vendor.getTenantId().equals(tenantId)) {
      throw new AggregateNotFoundException('Vendor', input.vendorId);
    }

    vendor.deactivate();
    const data: VendorPersistenceData = {
      operation: 'update',
      id: input.vendorId,
      status: VendorStatusValue.INACTIVE,
    };
    await this.writeRepository.save(data);

    await this.outbox.appendMany(
      vendor.pullDomainEvents().map((event) =>
        event.toOutboxEventInput({
          tenantId: tenantId.getValue(),
          organizationId: this.requestContext.getOrganizationId(),
          correlationId: this.requestContext.getCorrelationId(),
        }),
      ),
    );

    return { vendorId: input.vendorId, status: 'INACTIVE' };
  }

  private requireTenantId(): TenantId {
    const value = this.requestContext.getTenantId();
    if (!value) throw new UnauthorizedException('Tenant context is required');
    return TenantId.from(value);
  }
}
