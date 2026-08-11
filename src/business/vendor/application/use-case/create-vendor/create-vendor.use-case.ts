import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ConflictException } from '../../../../../shared-kernel/exceptions/conflict.exception';
import { OrganizationId } from '../../../../../shared-business/value-object/organization-id';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { createUuid } from '../../../../../shared-kernel/utilities/uuid';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { OutboxPort } from '../../../domain/port/outbox.port';
import { VendorPersistenceData, VendorWriteRepositoryPort } from '../../../domain/port/vendor-write-repository.port';
import { VendorBuilder } from '../../../domain/service/vendor-builder.service';
import { VendorBankAccountIbanInvariant } from '../../../domain/invariant/vendor-bank-account-iban.invariant';
import { InvariantRegistry } from '../../../../../shared-business/invariant/invariant-registry';
import { VendorId } from '../../../domain/aggregate/vendor/vendor-id.vo';
import { VendorCode } from '../../../domain/value-object/vendor-code.vo';
import { VendorStatusValue } from '../../../domain/value-object/vendor-status.vo';
import { CreateVendorInput, CreateVendorOutput } from '../../type/create-vendor.input';
import { CreateVendorPort } from '../../port/create-vendor.port';

/**
 * Creates a new Vendor aggregate in a single transaction together with its
 * outbox events (transactional outbox).
 *
 * The domain (builder/aggregate) is used only to enforce invariants and
 * record domain events; the persistence data is assembled explicitly and the
 * repository never receives the aggregate.
 */
@Injectable()
export class CreateVendorUseCase implements CreateVendorPort {
  constructor(
    private readonly builder: VendorBuilder,
    private readonly writeRepository: VendorWriteRepositoryPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: CreateVendorInput): Promise<CreateVendorOutput> {
    const tenantId = this.requireTenantId();
    const organizationId = this.requireOrganizationId();

    InvariantRegistry.create()
      .add(new VendorBankAccountIbanInvariant())
      .enforceAll({
        ibans: (input.bankAccounts ?? []).map((account) => account.iban),
      });

    const existing = await this.writeRepository.findByCode(
      tenantId.getValue(),
      organizationId.getValue(),
      input.code,
    );
    if (existing) {
      throw new ConflictException(`Vendor with code "${input.code}" already exists`, {
        vendorId: existing.getId().getValue(),
      });
    }

    const vendorId = createUuid();
    const vendor = this.builder.create({
      id: VendorId.from(vendorId),
      tenantId: TenantId.from(tenantId.getValue()),
      organizationId: OrganizationId.from(organizationId.getValue()),
      ...input,
    });

    const data: VendorPersistenceData = {
      operation: 'create',
      id: vendorId,
      tenantId: tenantId.getValue(),
      organizationId: organizationId.getValue(),
      code: VendorCode.from(input.code).getValue(),
      name: input.name.trim(),
      status: VendorStatusValue.ACTIVE,
      email: input.email ?? null,
      phone: input.phone ?? null,
      taxIdentifier: input.taxIdentifier ?? null,
      addresses: (input.addresses ?? []).map((item) => ({
        id: createUuid(),
        type: item.type,
        line1: item.line1,
        line2: item.line2 ?? null,
        city: item.city,
        state: item.state ?? null,
        postalCode: item.postalCode ?? null,
        country: item.country,
      })),
      contacts: (input.contacts ?? []).map((item) => ({
        id: createUuid(),
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email,
        phone: item.phone ?? null,
        role: item.role ?? null,
        isPrimary: item.isPrimary ?? false,
      })),
      bankAccounts: (input.bankAccounts ?? []).map((item) => ({
        id: createUuid(),
        accountName: item.accountName,
        iban: item.iban,
        bankName: item.bankName ?? null,
        currency: item.currency,
        isDefault: item.isDefault ?? false,
      })),
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

    return { vendorId };
  }

  private requireTenantId(): TenantId {
    const value = this.requestContext.getTenantId();
    if (!value) {
      throw new UnauthorizedException('Tenant context is required');
    }
    return TenantId.from(value);
  }

  private requireOrganizationId(): OrganizationId {
    const value = this.requestContext.getOrganizationId();
    if (!value) {
      throw new UnauthorizedException('Organization context is required');
    }
    return OrganizationId.from(value);
  }
}
