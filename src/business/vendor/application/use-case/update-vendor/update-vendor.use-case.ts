import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { EmailAddress } from '../../../../../shared-business/value-object/email-address';
import { OrganizationId } from '../../../../../shared-business/value-object/organization-id';
import { PhoneNumber } from '../../../../../shared-business/value-object/phone-number';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { VendorId } from '../../../domain/aggregate/vendor/vendor-id.vo';
import { OutboxPort } from '../../../domain/port/outbox.port';
import { VendorPersistenceData, VendorWriteRepositoryPort } from '../../../domain/port/vendor-write-repository.port';
import { TaxIdentifier } from '../../../domain/value-object/tax-identifier.vo';
import { UpdateVendorInput, UpdateVendorOutput } from '../../type/update-vendor.input';
import { UpdateVendorPort } from '../../port/update-vendor.port';

/**
 * Updates a vendor profile inside a transaction.
 */
@Injectable()
export class UpdateVendorUseCase implements UpdateVendorPort {
  constructor(
    private readonly writeRepository: VendorWriteRepositoryPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: UpdateVendorInput): Promise<UpdateVendorOutput> {
    const tenantId = this.requireTenantId();
    const organizationId = this.requireOrganizationId();

    const vendor = await this.writeRepository.findById(VendorId.from(input.vendorId));
    if (!vendor || !vendor.getTenantId().equals(tenantId)) {
      throw new AggregateNotFoundException('Vendor', input.vendorId);
    }

    vendor.updateProfile({
      name: input.name,
      email: input.email !== undefined ? EmailAddress.from(input.email) : undefined,
      phone: input.phone !== undefined ? PhoneNumber.from(input.phone) : undefined,
      taxIdentifier:
        input.taxIdentifier !== undefined ? TaxIdentifier.from(input.taxIdentifier) : undefined,
    });

    const data: VendorPersistenceData = {
      operation: 'update',
      id: input.vendorId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      taxIdentifier: input.taxIdentifier,
    };
    await this.writeRepository.save(data);

    await this.outbox.appendMany(
      vendor.pullDomainEvents().map((event) =>
        event.toOutboxEventInput({
          tenantId: tenantId.getValue(),
          organizationId: organizationId.getValue(),
          correlationId: this.requestContext.getCorrelationId(),
        }),
      ),
    );

    return { vendorId: input.vendorId, updatedAt: new Date() };
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
